import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/libraryReadings.ts imports "server-only" and calls
// createSupabaseAdminClient()/getAuthenticatedLearnerProfile(), so per
// this codebase's established precedent (see
// learnerReturnedFeedback.test.ts's header comment) it cannot be invoked
// directly in a plain node:test run. The query-shape assertions below
// confirm the real source contains the exact filter/embed chain this
// test's mirrored logic assumes, so the two stay in sync intentionally;
// the authorization-branching and term/topic/lesson grouping logic itself
// is mirrored here and exercised directly.

const SOURCE = readFileSync("lib/supabase/libraryReadings.ts", "utf8");

// --- Query-shape source assertions ------------------------------------

test("the query is scoped to the exact authorized subject's databaseId and to published lessons only", () => {
  assert.match(SOURCE, /\.eq\("subject_id", subjectDatabaseId\)/);
  assert.match(SOURCE, /\.eq\("status", "published"\)/);
});

test("the query embeds lesson_materials via an inner join with dot-notation filters, never a second .in(\"lesson_id\", ...) query built from a lessonIds array", () => {
  assert.match(SOURCE, /lesson_materials!inner\(id, material_type, source_type\)/);
  assert.match(SOURCE, /\.eq\("lesson_materials\.material_type", "reading"\)/);
  assert.match(SOURCE, /\.eq\("lesson_materials\.source_type", "pdf"\)/);
  // No ID-array variable (e.g. "const lessonIds = ...") or .in(...) call
  // exists anywhere as actual code -- checked against the source with
  // comment lines stripped first, since this file's own comments discuss
  // (in prose) why no such array/call is needed.
  const codeOnly = SOURCE.split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(codeOnly, /const \w*[Ll]essonIds\w* =/);
  assert.doesNotMatch(codeOnly, /\.in\(/);
});

test("8/9/10/11: the query's own filters are what exclude draft lessons, pasted_text/non-pdf readings, lessons with no reading material, and (via the exact subjectDatabaseId filter) lessons from any other subject -- these are enforced at the database level, before any row ever reaches the grouping logic", () => {
  assert.match(SOURCE, /\.eq\("status", "published"\)/, "excludes draft lessons");
  assert.match(SOURCE, /\.eq\("lesson_materials\.source_type", "pdf"\)/, "excludes pasted_text/Kingdom-generated-text readings");
  assert.match(SOURCE, /lesson_materials!inner/, "excludes lessons with no reading material at all (inner join)");
  assert.match(SOURCE, /\.eq\("subject_id", subjectDatabaseId\)/, "excludes lessons belonging to any other subject");
});

test("the select never requests content_url or any storage-path column", () => {
  const selectStart = SOURCE.indexOf(".select(");
  assert.ok(selectStart > -1, "expected a .select(...) call");
  const embedIndex = SOURCE.indexOf("lesson_materials!inner", selectStart);
  assert.ok(embedIndex > selectStart);
  const selectEnd = SOURCE.indexOf(")", embedIndex);
  const selectCall = SOURCE.slice(selectStart, selectEnd);
  assert.doesNotMatch(selectCall, /content_url/);
});

test("no Supabase Storage call exists anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /\.storage\b/);
  assert.doesNotMatch(SOURCE, /createSignedUrl/);
  assert.doesNotMatch(SOURCE, /createSignedUploadUrl/);
  assert.doesNotMatch(SOURCE, /\.download\(/);
  assert.doesNotMatch(SOURCE, /\.upload\(/);
  assert.doesNotMatch(SOURCE, /\.remove\(/);
});

test("no progress/activity/XP/Coin table or query is referenced anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /learner_lesson_progress/);
  assert.doesNotMatch(SOURCE, /activity_submissions/);
  assert.doesNotMatch(SOURCE, /activity_submission_answers/);
  assert.doesNotMatch(SOURCE, /\.from\("coin/i);
  assert.doesNotMatch(SOURCE, /coin_ledger|coinLedger|coinRewardTrigger/i);
  assert.doesNotMatch(SOURCE, /\.from\("xp/i);
  assert.doesNotMatch(SOURCE, /quiz_attempt/);
  // "Coins"/"XP" appear only in this file's own descriptive header
  // comment (explaining what Library Club deliberately excludes), never
  // as an actual table reference, import, or query -- confirmed above.
});

test("authorization reuses the canonical learner profile and subject-access helpers rather than duplicating enrolment logic", () => {
  assert.match(
    SOURCE,
    /import \{ getAuthenticatedLearnerProfile \} from "@\/lib\/supabase\/learnerProfile";/,
  );
  assert.match(
    SOURCE,
    /import \{ verifyLearnerSubjectAccessForProfile \} from "@\/lib\/supabase\/subjectAccess";/,
  );
  assert.match(SOURCE, /verifyLearnerSubjectAccessForProfile\(\s*\n\s*profile,\s*\n\s*subject\.databaseId,\s*\n\s*\);/);
  assert.doesNotMatch(SOURCE, /\.from\("learner_subjects"\)/);
  assert.doesNotMatch(SOURCE, /\.from\("learner_profiles"\)/);
});

test("the requested subjectKey is resolved to its canonical subject configuration before any authorization check, and isSubjectKey guards an unknown key", () => {
  assert.match(SOURCE, /if \(!isSubjectKey\(requestedSubjectKey\)\) \{\s*\n\s*return \{ status: "unknown_subject" \};/);
  assert.match(SOURCE, /const subject = getSubjectConfiguration\(requestedSubjectKey\);/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});

// --- Mirrored authorization branching ---------------------------------

type SubjectKey = "english-stage-8" | "english-stage-9" | "business-studies";

const SUBJECTS: Record<SubjectKey, { databaseId: string; familyKey: string }> = {
  "english-stage-8": { databaseId: "subj-eng-8", familyKey: "english" },
  "english-stage-9": { databaseId: "subj-eng-9", familyKey: "english" },
  "business-studies": { databaseId: "subj-bs", familyKey: "business-studies" },
};

type Profile = { approvedSubjects: { id: string }[] } | null;

// Mirrors getAuthenticatedLearnerLibraryForSubject's authorization
// branching exactly: unknown key -> "unknown_subject"; no profile ->
// "unauthenticated"; profile without that exact databaseId enrolled ->
// "not_enrolled"; otherwise "ok". Authorization is keyed strictly by the
// resolved databaseId, never by familyKey.
function resolveAuthorization(
  requestedKey: string,
  profile: Profile,
): "unknown_subject" | "unauthenticated" | "not_enrolled" | "ok" {
  const subject = SUBJECTS[requestedKey as SubjectKey];
  if (!subject) return "unknown_subject";
  if (!profile) return "unauthenticated";

  const hasAccess = profile.approvedSubjects.some(
    (approved) => approved.id === subject.databaseId,
  );
  return hasAccess ? "ok" : "not_enrolled";
}

test("1: an unauthenticated (null profile) learner is denied, not treated as an error", () => {
  assert.equal(resolveAuthorization("english-stage-8", null), "unauthenticated");
});

test("2: an unknown subjectKey is handled safely without querying any subject ID", () => {
  assert.equal(
    resolveAuthorization("not-a-real-subject", { approvedSubjects: [] }),
    "unknown_subject",
  );
});

test("3: a valid subject the learner is not enrolled in is denied", () => {
  assert.equal(
    resolveAuthorization("english-stage-8", { approvedSubjects: [{ id: "subj-bs" }] }),
    "not_enrolled",
  );
});

test("4: authorization is checked against the exact resolved database subject ID, not the requested key string", () => {
  const profile = { approvedSubjects: [{ id: "subj-eng-8" }] };
  assert.equal(resolveAuthorization("english-stage-8", profile), "ok");
});

test("5: enrolment in one subject variant does NOT grant access to a sibling variant sharing the same familyKey", () => {
  const enrolledOnlyInStage8 = { approvedSubjects: [{ id: "subj-eng-8" }] };
  assert.equal(resolveAuthorization("english-stage-8", enrolledOnlyInStage8), "ok");
  assert.equal(resolveAuthorization("english-stage-9", enrolledOnlyInStage8), "not_enrolled");
  assert.equal(SUBJECTS["english-stage-8"].familyKey, SUBJECTS["english-stage-9"].familyKey);
});

// --- Mirrored term/topic/lesson grouping -------------------------------

type Row = {
  id: string;
  lesson_number: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  topic_id: string | null;
  topic: { id: string; title: string } | { id: string; title: string }[] | null;
  lesson_materials: { id: string }[];
};

const GENERAL_TOPIC_LABEL = "General";

type LibraryLessonItem = {
  lessonId: string;
  materialId: string;
  lessonNumber: string;
  title: string;
  weekNumber: number | null;
};

function resolveTopicTitle(row: Row["topic"]): string | null {
  const normalised = Array.isArray(row) ? row[0] : row;
  return normalised?.title?.trim() || null;
}

function compareLessonNumbers(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// Mirrors buildTerms in the real source exactly: group by term_number
// (numbered ascending, null last, never dropped); within a term, sort
// lessons by lesson_number numeric-ascending; group into topics in order
// of first appearance in that already-sorted sequence (= earliest
// lesson); a null topic_id falls back to the literal "General" label.
function buildTerms(rows: Row[]) {
  const rowsByTerm = new Map<number | null, Row[]>();
  for (const row of rows) {
    const existing = rowsByTerm.get(row.term_number);
    if (existing) existing.push(row);
    else rowsByTerm.set(row.term_number, [row]);
  }

  const orderedTermNumbers = [...rowsByTerm.keys()].sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return orderedTermNumbers.map((termNumber) => {
    const termRows = [...rowsByTerm.get(termNumber)!].sort((a, b) =>
      compareLessonNumbers(a.lesson_number, b.lesson_number),
    );

    const topicOrder: string[] = [];
    const topicsByKey = new Map<
      string,
      { topicId: string | null; topicTitle: string; lessons: LibraryLessonItem[] }
    >();

    for (const row of termRows) {
      const topicKey = row.topic_id ?? "__general__";
      let topic = topicsByKey.get(topicKey);
      if (!topic) {
        topic = {
          topicId: row.topic_id,
          topicTitle: resolveTopicTitle(row.topic) ?? GENERAL_TOPIC_LABEL,
          lessons: [],
        };
        topicsByKey.set(topicKey, topic);
        topicOrder.push(topicKey);
      }
      topic.lessons.push({
        lessonId: row.id,
        materialId: row.lesson_materials[0].id,
        lessonNumber: row.lesson_number,
        title: row.title,
        weekNumber: row.week_number,
      });
    }

    return { termNumber, topics: topicOrder.map((key) => topicsByKey.get(key)!) };
  });
}

function makeRow(overrides: Partial<Row>): Row {
  return {
    id: "lesson-1",
    lesson_number: "1.1",
    title: "Lesson",
    term_number: 1,
    week_number: 1,
    topic_id: null,
    topic: null,
    lesson_materials: [{ id: "material-1" }],
    ...overrides,
  };
}

test("6/7/12: multiple published PDF lessons across subjects are each returned exactly once", () => {
  const rows = [
    makeRow({ id: "l1", lesson_number: "1.1", lesson_materials: [{ id: "m1" }] }),
    makeRow({ id: "l2", lesson_number: "1.2", lesson_materials: [{ id: "m2" }] }),
  ];
  const terms = buildTerms(rows);
  const allLessons = terms.flatMap((term) => term.topics.flatMap((topic) => topic.lessons));
  assert.equal(allLessons.length, 2);
  assert.deepEqual(allLessons.map((lesson) => lesson.lessonId), ["l1", "l2"]);
});

test("6: an enrolled subject with zero eligible rows returns a valid, empty terms array -- never throws", () => {
  const terms = buildTerms([]);
  assert.deepEqual(terms, []);
});

test("13/14: numbered terms are grouped and ordered ascending (1, 2, 3, 4), never newest-first", () => {
  const rows = [
    makeRow({ id: "l-t3", term_number: 3, lesson_number: "3.1" }),
    makeRow({ id: "l-t1", term_number: 1, lesson_number: "1.1" }),
    makeRow({ id: "l-t2", term_number: 2, lesson_number: "2.1" }),
  ];
  const terms = buildTerms(rows);
  assert.deepEqual(terms.map((term) => term.termNumber), [1, 2, 3]);
});

test("15: null-term coursework is retained, placed after every numbered term, never dropped and never invented as Term 1", () => {
  const rows = [
    makeRow({ id: "l-null", term_number: null, lesson_number: "1.1" }),
    makeRow({ id: "l-t1", term_number: 1, lesson_number: "1.1" }),
  ];
  const terms = buildTerms(rows);
  assert.deepEqual(terms.map((term) => term.termNumber), [1, null]);
});

test("16/17: topics group by actual subject_topics.title; a topic-less lesson falls back to the literal 'General' label, never the lesson title", () => {
  const rows = [
    makeRow({
      id: "l-topic",
      topic_id: "topic-1",
      topic: { id: "topic-1", title: "Macroeconomics" },
    }),
    makeRow({ id: "l-no-topic", lesson_number: "1.2", topic_id: null, topic: null, title: "Standalone Lesson" }),
  ];
  const terms = buildTerms(rows);
  const topicTitles = terms[0].topics.map((topic) => topic.topicTitle);
  assert.deepEqual(topicTitles, ["Macroeconomics", "General"]);
  assert.ok(!topicTitles.includes("Standalone Lesson"));
});

test("18: lessons within a topic order by lesson_number numeric-ascending, not lexicographically", () => {
  const rows = [
    makeRow({ id: "l-3-10", lesson_number: "3.10" }),
    makeRow({ id: "l-3-1", lesson_number: "3.1" }),
    makeRow({ id: "l-3-2", lesson_number: "3.2" }),
    makeRow({ id: "l-3-9", lesson_number: "3.9" }),
    makeRow({ id: "l-3-11", lesson_number: "3.11" }),
  ];
  const terms = buildTerms(rows);
  const order = terms[0].topics[0].lessons.map((lesson) => lesson.lessonId);
  assert.deepEqual(order, ["l-3-1", "l-3-2", "l-3-9", "l-3-10", "l-3-11"]);
});

test("19/22: topics within a term appear in order of their earliest lesson, not alphabetically", () => {
  const rows = [
    makeRow({ id: "l-b-1", lesson_number: "3.5", topic_id: "topic-b", topic: { id: "topic-b", title: "Topic B" } }),
    makeRow({ id: "l-a-1", lesson_number: "3.1", topic_id: "topic-a", topic: { id: "topic-a", title: "Topic A" } }),
    makeRow({ id: "l-a-2", lesson_number: "3.2", topic_id: "topic-a", topic: { id: "topic-a", title: "Topic A" } }),
    makeRow({ id: "l-b-2", lesson_number: "3.6", topic_id: "topic-b", topic: { id: "topic-b", title: "Topic B" } }),
  ];
  const terms = buildTerms(rows);
  assert.deepEqual(terms[0].topics.map((topic) => topic.topicTitle), ["Topic A", "Topic B"]);
});

test("the topic relation is normalised whether PostgREST returns it as a single object or a one-element array", () => {
  assert.equal(resolveTopicTitle({ id: "t1", title: "Array-wrapped" }), "Array-wrapped");
  assert.equal(resolveTopicTitle([{ id: "t1", title: "Array-wrapped" }]), "Array-wrapped");
  assert.equal(resolveTopicTitle(null), null);
});

test("each returned lesson exposes lessonId and materialId, and no content_url/storage path field", () => {
  const rows = [makeRow({ id: "l1", lesson_materials: [{ id: "m1" }] })];
  const terms = buildTerms(rows);
  const lesson = terms[0].topics[0].lessons[0] as Record<string, unknown>;
  assert.equal(lesson.lessonId, "l1");
  assert.equal(lesson.materialId, "m1");
  assert.ok(!("contentUrl" in lesson));
  assert.ok(!("content_url" in lesson));
  assert.ok(!("storagePath" in lesson));
});
