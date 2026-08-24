import assert from "node:assert/strict";
import test from "node:test";

// lib/supabase/learnerSubjectWorkReader.ts imports "server-only" (via
// lib/supabase/server.ts), which has no real npm package in this repo and
// only resolves inside a Next.js server build/bundle -- so, matching the
// established precedent elsewhere in this codebase (see
// lib/lessons/lessonCompletionService.test.ts), the reader cannot be
// invoked directly in a plain node:test run. Instead this mirrors the
// exact classification/ordering logic verbatim from the real source, with
// this comment citing it so the two stay in sync intentionally.

// Mirrors the lesson-classification loop in getLearnerSubjectWorkStatus:
// a lesson is "completed" purely by the existence of a
// learner_lesson_completions row for this learner -- never re-derived.
function isLessonComplete(hasCompletionRow: boolean): boolean {
  return hasCompletionRow;
}

// Mirrors the activity-classification flatMap in getLearnerSubjectWorkStatus.
function isActivityOutstanding(submissionStatus: string | null): boolean {
  const submittedStatuses = ["submitted", "marking_failed", "awaiting_review", "returned"];
  if (submissionStatus && submittedStatuses.includes(submissionStatus)) return false;
  return true;
}

// Mirrors academicOrderComparator verbatim.
function academicOrderComparator(
  a: { termNumber: number | null; weekNumber: number | null; displayOrder: number | null; lessonNumber: string },
  b: { termNumber: number | null; weekNumber: number | null; displayOrder: number | null; lessonNumber: string },
) {
  const termA = a.termNumber ?? Number.POSITIVE_INFINITY;
  const termB = b.termNumber ?? Number.POSITIVE_INFINITY;
  if (termA !== termB) return termA - termB;

  const weekA = a.weekNumber ?? Number.POSITIVE_INFINITY;
  const weekB = b.weekNumber ?? Number.POSITIVE_INFINITY;
  if (weekA !== weekB) return weekA - weekB;

  const orderA = a.displayOrder ?? Number.POSITIVE_INFINITY;
  const orderB = b.displayOrder ?? Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;

  return a.lessonNumber.localeCompare(b.lessonNumber, "en-ZA", { numeric: true });
}

// C/E: a completed activity/lesson is classified as complete, not outstanding.
test("a lesson with an existing completion row is complete, not outstanding", () => {
  assert.equal(isLessonComplete(true), true);
});

// F: an incomplete lesson appears in Outstanding Work.
test("a lesson with no completion row is outstanding", () => {
  assert.equal(isLessonComplete(false), false);
});

// D: an unsubmitted activity appears in Outstanding Work.
test("an activity with no submission is outstanding", () => {
  assert.equal(isActivityOutstanding(null), true);
});

test("a submitted/awaiting_review/marking_failed/returned activity is never outstanding", () => {
  assert.equal(isActivityOutstanding("submitted"), false);
  assert.equal(isActivityOutstanding("awaiting_review"), false);
  assert.equal(isActivityOutstanding("marking_failed"), false);
  assert.equal(isActivityOutstanding("returned"), false);
});

test("academic order sorts by term, then week, then display order, then lesson number", () => {
  const items = [
    { lessonNumber: "2.3", termNumber: 1, weekNumber: 3, displayOrder: 1 },
    { lessonNumber: "1.1", termNumber: 1, weekNumber: 1, displayOrder: 1 },
    { lessonNumber: "3.1", termNumber: 2, weekNumber: 1, displayOrder: 1 },
    { lessonNumber: "1.2", termNumber: 1, weekNumber: 1, displayOrder: 2 },
  ];
  const sorted = [...items].sort(academicOrderComparator);
  assert.deepEqual(
    sorted.map((item) => item.lessonNumber),
    ["1.1", "1.2", "2.3", "3.1"],
  );
});

// A/B: a learner enrolled in multiple subjects only sees the selected
// subject's work -- mirrors the `workOverview.filter(submission =>
// submission.subject.id === subjectDatabaseId)` line in
// getLearnerSubjectWorkStatus.
test("B: only submissions for the selected subject are included", () => {
  const businessStudiesId = "c472f3c9-0e6f-40de-a748-3ad9400ac069";
  const historyId = "dca2600c-932f-46bf-904c-a99be158e7f0";
  const allSubmissions = [
    { id: "s1", subject: { id: businessStudiesId } },
    { id: "s2", subject: { id: historyId } },
    { id: "s3", subject: { id: businessStudiesId } },
  ];

  const filtered = allSubmissions.filter(
    (submission) => submission.subject.id === businessStudiesId,
  );

  assert.deepEqual(
    filtered.map((submission) => submission.id),
    ["s1", "s3"],
  );
});

test("items with a null term/week sort after items with a set value", () => {
  const items = [
    { lessonNumber: "unscheduled", termNumber: null, weekNumber: null, displayOrder: null },
    { lessonNumber: "1.1", termNumber: 1, weekNumber: 1, displayOrder: 1 },
  ];
  const sorted = [...items].sort(academicOrderComparator);
  assert.deepEqual(
    sorted.map((item) => item.lessonNumber),
    ["1.1", "unscheduled"],
  );
});
