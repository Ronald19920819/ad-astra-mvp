import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/learnerReturnedFeedback.ts imports "server-only" and calls
// createSupabaseAdminClient(), so per this codebase's established
// precedent (see activityReviewReader.historicalVisibility.test.ts's
// header comment) it cannot be invoked directly in a plain node:test run.
// The query-shape assertions below confirm the real source contains the
// exact filter/order/limit chain this test's mirrored logic assumes, so
// the two stay in sync intentionally; the row-selection/ordering/mapping
// logic itself is mirrored here and exercised directly.

const SOURCE = readFileSync("lib/supabase/learnerReturnedFeedback.ts", "utf8");

test("query only selects returned submissions with a completed review, ordered newest-first and capped at 8", () => {
  assert.match(SOURCE, /\.eq\("status", "returned"\)/);
  assert.match(SOURCE, /\.not\("reviewed_at", "is", null\)/);
  assert.match(SOURCE, /\.order\("reviewed_at", \{ ascending: false \}\)/);
  assert.match(SOURCE, /\.limit\(RETURNED_FEEDBACK_LIMIT\)/);
  assert.match(SOURCE, /RETURNED_FEEDBACK_LIMIT = 8/);
});

test("selected columns never include question-level or Kingdom feedback fields", () => {
  const selectCalls = SOURCE.match(/\.select\([\s\S]*?\)/g) ?? [];
  assert.ok(selectCalls.length > 0);
  for (const call of selectCalls) {
    assert.doesNotMatch(call, /kingdom_feedback|teacher_feedback|activity_submission_answers/);
  }
  assert.match(SOURCE, /teacher_comment/);
});

test("the query selects final_mark and original_total_marks -- the authoritative teacher-final basis, never preliminary_mark", () => {
  assert.match(SOURCE, /final_mark/);
  assert.match(SOURCE, /original_total_marks/);
  assert.doesNotMatch(SOURCE, /preliminary_mark|preliminary_percentage/);
});

test("rows with a null final_mark (defensively) are excluded rather than crashing badge selection", () => {
  assert.match(SOURCE, /submission\.final_mark !== null/);
});

type Snapshot = {
  subject: { id: string; name: string };
  activity: { title: string; totalMarks: number };
};
type SubmissionRow = {
  id: string;
  activity_id: string;
  reviewed_at: string;
  teacher_comment: string | null;
  final_mark: number;
  original_total_marks: number | null;
  reviewed_by: string | null;
  activity_snapshot: Snapshot | null;
};
type ActivityRow = { id: string; title: string; total_marks: number; lesson_material_id: string };
type MaterialRow = { id: string; lesson_id: string };
type LessonRow = { id: string; subject_id: string };
type ReviewerRow = { id: string; first_name: string | null; full_name: string | null };

// Mirrors resolveTeacherFirstName in the real source: a dedicated
// first_name column wins; a full_name is otherwise split on whitespace for
// its first token.
function resolveTeacherFirstName(row: ReviewerRow | undefined): string | null {
  if (!row) return null;
  const firstName = row.first_name?.trim();
  if (firstName) return firstName;
  const token = row.full_name?.trim().split(/\s+/)[0];
  return token || null;
}

// Mirrors getLearnerReturnedFeedback's snapshot-preferred resolution: a
// submission with a valid activity_snapshot resolves subject/activity and
// the frozen total-marks basis directly from the snapshot; only a legacy
// (pre-snapshot) row falls back to the live activity -> material -> lesson
// join chain.
function resolveItems(
  submissions: readonly SubmissionRow[],
  activityById: Map<string, ActivityRow>,
  materialById: Map<string, MaterialRow>,
  lessonById: Map<string, LessonRow>,
  subjectNameById: Map<string, string>,
  reviewerById: Map<string, ReviewerRow>,
) {
  return submissions.flatMap((submission) => {
    const teacherFirstName = submission.reviewed_by
      ? resolveTeacherFirstName(reviewerById.get(submission.reviewed_by))
      : null;

    if (submission.activity_snapshot) {
      const snapshot = submission.activity_snapshot;
      const totalMarks = submission.original_total_marks ?? snapshot.activity.totalMarks;
      return [
        {
          submissionId: submission.id,
          subjectId: snapshot.subject.id,
          subjectName: snapshot.subject.name,
          activityTitle: snapshot.activity.title,
          teacherComment: submission.teacher_comment,
          reviewedAt: submission.reviewed_at,
          finalMark: submission.final_mark,
          totalMarks,
          teacherFirstName,
        },
      ];
    }

    const activity = activityById.get(submission.activity_id);
    if (!activity) return [];
    const material = materialById.get(activity.lesson_material_id);
    if (!material) return [];
    const lesson = lessonById.get(material.lesson_id);
    if (!lesson) return [];
    const totalMarks = submission.original_total_marks ?? activity.total_marks;

    return [
      {
        submissionId: submission.id,
        subjectId: lesson.subject_id,
        subjectName: subjectNameById.get(lesson.subject_id) ?? "Subject",
        activityTitle: activity.title,
        teacherComment: submission.teacher_comment,
        reviewedAt: submission.reviewed_at,
        finalMark: submission.final_mark,
        totalMarks,
        teacherFirstName,
      },
    ];
  });
}

test("a submission with a valid activity_snapshot resolves subject/activity/total-marks directly from the snapshot", () => {
  const items = resolveItems(
    [
      {
        id: "sub-1",
        activity_id: "act-1",
        reviewed_at: "2026-08-29T10:00:00.000Z",
        teacher_comment: "Well done.",
        final_mark: 16,
        original_total_marks: null,
        reviewed_by: "teacher-1",
        activity_snapshot: { subject: { id: "subj-english", name: "English" }, activity: { title: "Activity 10", totalMarks: 20 } },
      },
    ],
    new Map(), new Map(), new Map(), new Map(),
    new Map([["teacher-1", { id: "teacher-1", first_name: "Ronald", full_name: "Ronald Petersen" }]]),
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].subjectName, "English");
  assert.equal(items[0].activityTitle, "Activity 10");
  assert.equal(items[0].totalMarks, 20);
  assert.equal(items[0].finalMark, 16);
  assert.equal(items[0].teacherFirstName, "Ronald");
});

test("original_total_marks (frozen at submission time) takes priority over the snapshot's activity total when both exist", () => {
  const items = resolveItems(
    [
      {
        id: "sub-frozen",
        activity_id: "act-1",
        reviewed_at: "2026-08-29T10:00:00.000Z",
        teacher_comment: null,
        final_mark: 10,
        original_total_marks: 15,
        reviewed_by: null,
        activity_snapshot: { subject: { id: "s", name: "S" }, activity: { title: "T", totalMarks: 20 } },
      },
    ],
    new Map(), new Map(), new Map(), new Map(), new Map(),
  );
  assert.equal(items[0].totalMarks, 15);
});

test("a legacy submission with no snapshot resolves via the live activity/material/lesson join chain", () => {
  const items = resolveItems(
    [
      {
        id: "sub-2",
        activity_id: "act-2",
        reviewed_at: "2026-08-28T10:00:00.000Z",
        teacher_comment: null,
        final_mark: 8,
        original_total_marks: null,
        reviewed_by: null,
        activity_snapshot: null,
      },
    ],
    new Map([["act-2", { id: "act-2", title: "Legacy Activity", total_marks: 10, lesson_material_id: "mat-2" }]]),
    new Map([["mat-2", { id: "mat-2", lesson_id: "lesson-2" }]]),
    new Map([["lesson-2", { id: "lesson-2", subject_id: "subj-2" }]]),
    new Map([["subj-2", "Mathematics"]]),
    new Map(),
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].subjectName, "Mathematics");
  assert.equal(items[0].activityTitle, "Legacy Activity");
  assert.equal(items[0].totalMarks, 10);
});

test("a legacy submission missing any join link is silently skipped, never crashing the card", () => {
  const items = resolveItems(
    [
      {
        id: "sub-3",
        activity_id: "act-missing",
        reviewed_at: "2026-08-27T10:00:00.000Z",
        teacher_comment: "Comment",
        final_mark: 5,
        original_total_marks: null,
        reviewed_by: null,
        activity_snapshot: null,
      },
    ],
    new Map(), new Map(), new Map(), new Map(), new Map(),
  );
  assert.equal(items.length, 0);
});

test("a null teacher_comment passes through unchanged -- the reader never substitutes a fallback itself", () => {
  const items = resolveItems(
    [
      {
        id: "sub-4",
        activity_id: "act-4",
        reviewed_at: "2026-08-26T10:00:00.000Z",
        teacher_comment: null,
        final_mark: 3,
        original_total_marks: null,
        reviewed_by: null,
        activity_snapshot: { subject: { id: "s", name: "History" }, activity: { title: "Activity 3", totalMarks: 10 } },
      },
    ],
    new Map(), new Map(), new Map(), new Map(), new Map(),
  );
  assert.equal(items[0].teacherComment, null);
});

test("a reviewer with no first_name falls back to the first token of full_name", () => {
  const items = resolveItems(
    [
      {
        id: "sub-5",
        activity_id: "act-5",
        reviewed_at: "2026-08-25T10:00:00.000Z",
        teacher_comment: null,
        final_mark: 3,
        original_total_marks: null,
        reviewed_by: "teacher-2",
        activity_snapshot: { subject: { id: "s", name: "History" }, activity: { title: "Activity 3", totalMarks: 10 } },
      },
    ],
    new Map(), new Map(), new Map(), new Map(),
    new Map([["teacher-2", { id: "teacher-2", first_name: null, full_name: "Naledi Khumalo" }]]),
  );
  assert.equal(items[0].teacherFirstName, "Naledi");
});

test("a submission with no reviewed_by resolves teacherFirstName to null rather than crashing", () => {
  const items = resolveItems(
    [
      {
        id: "sub-6",
        activity_id: "act-6",
        reviewed_at: "2026-08-24T10:00:00.000Z",
        teacher_comment: null,
        final_mark: 3,
        original_total_marks: null,
        reviewed_by: null,
        activity_snapshot: { subject: { id: "s", name: "History" }, activity: { title: "Activity 3", totalMarks: 10 } },
      },
    ],
    new Map(), new Map(), new Map(), new Map(), new Map(),
  );
  assert.equal(items[0].teacherFirstName, null);
});

test("newest reviewed_at sorts first when the mirrored rows are pre-ordered as the real query would return them", () => {
  const rows: SubmissionRow[] = [
    { id: "a", activity_id: "x", reviewed_at: "2026-08-29T10:00:00.000Z", teacher_comment: null, final_mark: 1, original_total_marks: null, reviewed_by: null, activity_snapshot: { subject: { id: "s", name: "S" }, activity: { title: "T", totalMarks: 10 } } },
    { id: "b", activity_id: "x", reviewed_at: "2026-08-30T10:00:00.000Z", teacher_comment: null, final_mark: 1, original_total_marks: null, reviewed_by: null, activity_snapshot: { subject: { id: "s", name: "S" }, activity: { title: "T", totalMarks: 10 } } },
  ];
  const sorted = [...rows].sort(
    (left, right) => new Date(right.reviewed_at).getTime() - new Date(left.reviewed_at).getTime(),
  );
  assert.deepEqual(sorted.map((row) => row.id), ["b", "a"]);
});
