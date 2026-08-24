import assert from "node:assert/strict";
import test from "node:test";
import { calculateXpTotal, evaluateCoinGateStatus } from "@/lib/rewards/xpRules";

// lib/supabase/learnerXpReader.ts imports "server-only" (via
// lib/supabase/server.ts), which has no real npm package in this repo and
// only resolves inside a Next.js server build/bundle -- so, matching the
// established precedent elsewhere in this codebase (see
// lib/lessons/lessonCompletionService.test.ts), the reader cannot be
// invoked directly in a plain node:test run. Instead this mirrors
// summariseLearnerXp's exact aggregation logic verbatim, with this
// comment citing the real source so the two stay in sync intentionally.
// calculateXpTotal/evaluateCoinGateStatus themselves ARE imported for real
// (lib/rewards/xpRules.ts has no server-only dependency) -- only the
// Supabase-querying wrapper needs mirroring.
type CompletionRow = { learner_id: string; lesson_id: string };
type SubmissionRow = { learner_id: string; activity_id: string; status: string };
type Context = {
  publishedLessonSubjectById: Map<string, string>;
  activitySubjectById: Map<string, string>;
};

const SUBMITTED_STATUSES = new Set(["submitted", "marking_failed", "awaiting_review", "returned"]);

function summariseLearnerXp(
  learnerAuthUserId: string,
  completions: readonly CompletionRow[],
  submissions: readonly SubmissionRow[],
  context: Context,
) {
  const countedLessonIds = new Set<string>();
  const bySubjectLessons = new Map<string, number>();
  for (const completion of completions) {
    const subjectId = context.publishedLessonSubjectById.get(completion.lesson_id);
    if (!subjectId) continue;
    if (countedLessonIds.has(completion.lesson_id)) continue;
    countedLessonIds.add(completion.lesson_id);
    bySubjectLessons.set(subjectId, (bySubjectLessons.get(subjectId) ?? 0) + 1);
  }

  const countedActivityIds = new Set<string>();
  const bySubjectActivities = new Map<string, number>();
  for (const submission of submissions) {
    if (!SUBMITTED_STATUSES.has(submission.status)) continue;
    const subjectId = context.activitySubjectById.get(submission.activity_id);
    if (!subjectId) continue;
    if (countedActivityIds.has(submission.activity_id)) continue;
    countedActivityIds.add(submission.activity_id);
    bySubjectActivities.set(subjectId, (bySubjectActivities.get(subjectId) ?? 0) + 1);
  }

  const totalLessonsCompleted = countedLessonIds.size;
  const totalActivitiesCompleted = countedActivityIds.size;
  const totalXp = calculateXpTotal(totalLessonsCompleted, totalActivitiesCompleted);

  return {
    learnerAuthUserId,
    totalLessonsCompleted,
    totalActivitiesCompleted,
    totalXp,
    coinGateStatus: evaluateCoinGateStatus(totalXp, totalLessonsCompleted, totalActivitiesCompleted),
    bySubjectLessons,
    bySubjectActivities,
  };
}

const SUBJECT_A = "11111111-1111-1111-1111-111111111111";
const SUBJECT_B = "22222222-2222-2222-2222-222222222222";

test("a genuine completed lesson and submitted activity together produce 400 XP", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map([["lesson-1", SUBJECT_A]]),
    activitySubjectById: new Map([["activity-1", SUBJECT_A]]),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [{ learner_id: "learner-1", lesson_id: "lesson-1" }],
    [{ learner_id: "learner-1", activity_id: "activity-1", status: "submitted" }],
    context,
  );
  assert.equal(summary.totalXp, 400);
  assert.equal(summary.totalLessonsCompleted, 1);
  assert.equal(summary.totalActivitiesCompleted, 1);
});

test("a duplicate completion row for the same lesson is never double-counted", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map([["lesson-1", SUBJECT_A]]),
    activitySubjectById: new Map(),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [
      { learner_id: "learner-1", lesson_id: "lesson-1" },
      { learner_id: "learner-1", lesson_id: "lesson-1" },
    ],
    [],
    context,
  );
  assert.equal(summary.totalLessonsCompleted, 1);
  assert.equal(summary.totalXp, 200);
});

test("a duplicate submission row for the same activity is never double-counted", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map(),
    activitySubjectById: new Map([["activity-1", SUBJECT_A]]),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [],
    [
      { learner_id: "learner-1", activity_id: "activity-1", status: "submitted" },
      { learner_id: "learner-1", activity_id: "activity-1", status: "returned" },
    ],
    context,
  );
  assert.equal(summary.totalActivitiesCompleted, 1);
  assert.equal(summary.totalXp, 200);
});

test("XP does not require teacher review -- any submitted-family status counts", () => {
  for (const status of ["submitted", "marking_failed", "awaiting_review", "returned"]) {
    const context: Context = {
      publishedLessonSubjectById: new Map(),
      activitySubjectById: new Map([["activity-1", SUBJECT_A]]),
    };
    const summary = summariseLearnerXp(
      "learner-1",
      [],
      [{ learner_id: "learner-1", activity_id: "activity-1", status }],
      context,
    );
    assert.equal(summary.totalActivitiesCompleted, 1, `status "${status}" should count`);
  }
});

// Excluded false activity records: a completion/submission whose lesson or
// activity isn't in the linkage context (unpublished lesson, quiz-linked
// material, or removed content) contributes nothing.
test("a completion for an unpublished/removed lesson is excluded", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map(), // lesson-1 NOT present -> unpublished/removed
    activitySubjectById: new Map(),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [{ learner_id: "learner-1", lesson_id: "lesson-1" }],
    [],
    context,
  );
  assert.equal(summary.totalLessonsCompleted, 0);
  assert.equal(summary.totalXp, 0);
});

test("a submission for a quiz-linked/unpublished activity is excluded", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map(),
    activitySubjectById: new Map(), // activity-1 NOT present -> quiz-linked or unpublished
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [],
    [{ learner_id: "learner-1", activity_id: "activity-1", status: "submitted" }],
    context,
  );
  assert.equal(summary.totalActivitiesCompleted, 0);
  assert.equal(summary.totalXp, 0);
});

// Subject isolation: XP is global, but attributed per subject.
test("Stage 8/9 (or any two distinct subjects) contribute separately, summing to one global total", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map([
      ["lesson-a", SUBJECT_A],
      ["lesson-b", SUBJECT_B],
    ]),
    activitySubjectById: new Map(),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    [
      { learner_id: "learner-1", lesson_id: "lesson-a" },
      { learner_id: "learner-1", lesson_id: "lesson-b" },
    ],
    [],
    context,
  );
  assert.equal(summary.bySubjectLessons.get(SUBJECT_A), 1);
  assert.equal(summary.bySubjectLessons.get(SUBJECT_B), 1);
  assert.equal(summary.totalXp, 400); // one global total across both subjects
});

// Coin Gate audit field, calculated but not implemented.
test("Coin Gate status is calculated from the aggregated totals via evaluateCoinGateStatus", () => {
  const context: Context = {
    publishedLessonSubjectById: new Map(
      Array.from({ length: 5 }, (_, i) => [`lesson-${i}`, SUBJECT_A] as const),
    ),
    activitySubjectById: new Map(
      Array.from({ length: 5 }, (_, i) => [`activity-${i}`, SUBJECT_A] as const),
    ),
  };
  const summary = summariseLearnerXp(
    "learner-1",
    Array.from({ length: 5 }, (_, i) => ({ learner_id: "learner-1", lesson_id: `lesson-${i}` })),
    Array.from({ length: 5 }, (_, i) => ({
      learner_id: "learner-1",
      activity_id: `activity-${i}`,
      status: "submitted",
    })),
    context,
  );
  assert.equal(summary.totalXp, 2000);
  assert.equal(summary.coinGateStatus, "unlocked");
});
