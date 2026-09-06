import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// monthlyReportEngine.ts begins with `import "server-only"` (not a real
// installed package, only resolvable inside a Next.js server bundle) and
// calls createSupabaseAdminClient(), so per this codebase's established
// precedent (see activityReviewReader.historicalVisibility.test.ts's
// header comment) it cannot be invoked directly in a plain node:test run.
// The actual calculation logic it orchestrates is covered by real,
// directly-executed tests in monthlyReportCalculations.test.ts,
// monthlyReportBadge.test.ts, and monthlyReportLateness.test.ts -- these
// assertions instead verify the engine's own structural properties: what
// it reads, what it never writes, and which canonical helpers it reuses.

const SOURCE = readFileSync("lib/reports/monthlyReportEngine.ts", "utf8");

test("the engine is server-only", () => {
  assert.match(SOURCE, /^import "server-only";/);
});

test("lessons and activities are sorted into ascending curriculum order via the shared canonical helper before being used for any calculation or returned in the payload", () => {
  assert.match(
    SOURCE,
    /import \{\s*sortActivityEntriesByCurriculumOrder,\s*sortLessonEntriesByCurriculumOrder,\s*\} from "@\/lib\/reports\/monthlyReportOrdering";/,
  );
  assert.match(SOURCE, /const sortedLessons = sortLessonEntriesByCurriculumOrder\(lessons\);/);
  assert.match(
    SOURCE,
    /const sortedActivities = sortActivityEntriesByCurriculumOrder\(reportActivities\);/,
  );

  // The sort happens before engagement/academic/evidence are calculated
  // and before the final payload is built -- every downstream consumer
  // sees the sorted arrays, never the raw flatMap order.
  const sortIndex = SOURCE.indexOf("const sortedLessons =");
  const engagementIndex = SOURCE.indexOf("calculateEngagementSummary(sortedLessons, sortedActivities)");
  const payloadLessonsIndex = SOURCE.indexOf("lessons: sortedLessons,");
  const payloadActivitiesIndex = SOURCE.indexOf("activities: sortedActivities,");
  assert.ok(sortIndex > -1 && engagementIndex > -1 && payloadLessonsIndex > -1 && payloadActivitiesIndex > -1);
  assert.ok(sortIndex < engagementIndex);
  assert.ok(engagementIndex < payloadLessonsIndex);
  assert.ok(engagementIndex < payloadActivitiesIndex);
});

test("the raw (unsorted) lessons/reportActivities arrays are never returned in the final payload -- only the sorted versions", () => {
  assert.doesNotMatch(SOURCE, /lessons: lessons,|activities: reportActivities,/);
});

test("the engine performs no writes at all -- it is read-only by design", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});

test("lesson completion is read directly from learner_lesson_completions, never recomputed via evaluateAdaptiveLessonCompletion/evaluateAndPersistLessonCompletion", () => {
  assert.match(SOURCE, /\.from\("learner_lesson_completions"\)/);
  // Note: the header comment explains BY NAME why these are deliberately
  // not used -- this checks for an actual import/call, not that mention.
  assert.doesNotMatch(SOURCE, /from "@\/lib\/lessons\/lessonCompletionService"/);
  assert.doesNotMatch(SOURCE, /evaluateAdaptiveLessonCompletion\(|evaluateAndPersistLessonCompletion\(/);
});

test("lesson status reuses the canonical isLessonCompletionLate and isDateOverdue helpers, never a competing calculation", () => {
  assert.match(SOURCE, /import \{ isLessonCompletionLate \} from "@\/lib\/lessons\/adaptiveLessonCompletion";/);
  assert.match(SOURCE, /import \{ isDateOverdue \} from "@\/lib\/dates\/deadlineStatus";/);
  assert.match(SOURCE, /isLessonCompletionLate\(/);
  assert.match(SOURCE, /isDateOverdue\(/);
});

test("quiz-linked materials are excluded from activity counting via the canonical filterActivityBackedMaterialIds", () => {
  assert.match(SOURCE, /import \{ filterActivityBackedMaterialIds \} from "@\/lib\/activities\/activityBackedMaterial";/);
  assert.match(SOURCE, /activityBackedMaterialIds\.has\(activity\.lesson_material_id\)/);
});

test("Kingdom's preliminary mark is never read or used anywhere in the engine", () => {
  assert.doesNotMatch(SOURCE, /preliminary_mark|preliminary_percentage|preliminary_total|kingdom_marked_at/);
});

test("authoritative marks require status === 'returned' AND a non-null final_mark, exactly matching the Coin/returned-feedback gate", () => {
  assert.match(SOURCE, /submission\.status === "returned" && submission\.final_mark !== null/);
});

test("the frozen total-marks fallback chain matches the Coin engine and returned-feedback reader exactly: original_total_marks, then snapshot total, then live activity total", () => {
  assert.match(
    SOURCE,
    /submission\.original_total_marks \?\? snapshot\?\.activity\.totalMarks \?\? activity\.total_marks/,
  );
});

test("the frozen submission snapshot's due date takes precedence over the live activity due date, passed through to resolveActivityTiming", () => {
  assert.match(SOURCE, /snapshotDueDate: snapshot\?\.activity\.dueDate \?\? null/);
  assert.match(SOURCE, /liveDueDate: activity\.due_date/);
});

test("the two approved legacy exceptions are reused via their own exported helpers, never a duplicated generic mechanism", () => {
  assert.match(SOURCE, /import \{\s*LEGACY_ACTIVITY_5_ID,\s*deriveLegacyActivity5Window,\s*\} from "@\/lib\/rewards\/legacyActivity5Window";/);
  assert.match(SOURCE, /import \{\s*LEGACY_ACTIVITY_2_ID,\s*deriveLegacyActivity2Window,\s*\} from "@\/lib\/rewards\/legacyActivity2Window";/);
  assert.match(SOURCE, /selectedActivityIds\.includes\(LEGACY_ACTIVITY_5_ID\)/);
  assert.match(SOURCE, /selectedActivityIds\.includes\(LEGACY_ACTIVITY_2_ID\)/);
});

test("the legacy window is anchored platform-wide (not scoped to one learner), matching the Coin engine's own anchoring rule", () => {
  const findWindowFn = SOURCE.match(/async function findLegacyWindowEnd\([\s\S]*?\n\}/)?.[0];
  assert.ok(findWindowFn, "findLegacyWindowEnd not found");
  assert.doesNotMatch(findWindowFn!, /learner_id/);
});

test("all queries are explicitly scoped to the teacher-selected lesson/activity IDs, never the whole subject", () => {
  assert.match(SOURCE, /\.in\("id", selectedActivityIds\)/);
  assert.match(SOURCE, /\.in\("lesson_id", selectedLessonIds\)/);
  assert.match(SOURCE, /\.in\("activity_id", selectedActivityIds\)/);
});

test("the learner and subject display names are resolved via the existing canonical helpers, never a duplicated lookup", () => {
  assert.match(SOURCE, /import \{ getLearnerProfileByAuthUserId \} from "@\/lib\/supabase\/learnerProfile";/);
  assert.match(SOURCE, /import \{ getSubjectConfigurationByDatabaseId \} from "@\/lib\/subjects\/subjectConfig";/);
});

test("topic resolution reuses resolveCurrentTopicTitle's established lesson-title fallback, never a duplicated fallback", () => {
  assert.match(SOURCE, /import \{ resolveCurrentTopicTitle \} from "@\/lib\/subjects\/currentTopic";/);
});

test("the payload declares schemaVersion and a null attendance field, matching the reserved-for-later-stage contract", () => {
  assert.match(SOURCE, /schemaVersion: MONTHLY_REPORT_SCHEMA_VERSION/);
  assert.match(SOURCE, /attendance: null,/);
});

test("the teacher (subject teacher, not a future mentor) display name is resolved from profiles.id and never fabricated when unresolvable", () => {
  const fn = SOURCE.match(/async function resolveTeacherDisplayName\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "resolveTeacherDisplayName not found");
  assert.match(fn!, /\.from\("profiles"\)/);
  assert.match(fn!, /\.eq\("id", teacherId\)/);
  assert.match(fn!, /return null/);
  assert.match(fn!, /Promise<string \| null>/);
  assert.match(SOURCE, /const teacherName = await resolveTeacherDisplayName\(supabase, teacherId\);/);
});

test("this stage does not call OpenAI or any Kingdom generation endpoint anywhere", () => {
  // Note: a comment legitimately explains why Kingdom's preliminary mark
  // is never used -- this checks for actual API usage, not that mention.
  assert.doesNotMatch(SOURCE, /from "openai"|new OpenAI\(|\/api\/kingdom/i);
});
