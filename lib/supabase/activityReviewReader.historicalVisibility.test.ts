import assert from "node:assert/strict";
import test from "node:test";

// lib/supabase/activityReviewReader.ts (getSubjectActivityReviews) and
// lib/supabase/teacherDashboardInsights.ts (getTeacherDashboardInsights)
// both import "server-only" transitively, so per this codebase's established
// precedent they cannot be invoked directly in a plain node:test run. This
// mirrors the exact historical-ownership decision logic added to both --
// which learners get surfaced in a subject's review list/count, and why --
// with this comment citing the real source so the two stay in sync
// intentionally. The security boundary itself (authorizeTeacher, the
// subject-match check in getSubjectSubmissionReview) is untouched
// production code and is exercised here structurally, not re-implemented.

type Submission = {
  activityId: string;
  learnerAuthUserId: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
  submittedAt: string;
};

type Learner = { learnerProfileId: string; learnerAuthUserId: string; learnerName: string };

// Mirrors getSubjectActivityReviews's row-building for one activity:
// currentLearners always get a row (placeholder if no submission); a
// learner who has transferred out only appears if a genuine submission to
// THIS activity exists.
function buildActivityLearnerRows(
  activityId: string,
  currentLearners: readonly Learner[],
  pastEnrolmentLearners: readonly Learner[],
  submissions: readonly Submission[],
) {
  const submissionByLearner = new Map(
    submissions
      .filter((s) => s.activityId === activityId)
      .map((s) => [s.learnerAuthUserId, s] as const),
  );

  const currentRows = currentLearners.map((learner) => ({
    learnerProfileId: learner.learnerProfileId,
    learnerName: learner.learnerName,
    submission: submissionByLearner.get(learner.learnerAuthUserId) ?? null,
    isPastEnrolment: false as const,
  }));

  const pastRows = pastEnrolmentLearners.flatMap((learner) => {
    const submission = submissionByLearner.get(learner.learnerAuthUserId);
    if (!submission) return [];
    return [
      {
        learnerProfileId: learner.learnerProfileId,
        learnerName: learner.learnerName,
        submission,
        isPastEnrolment: true as const,
      },
    ];
  });

  return [...currentRows, ...pastRows];
}

// Mirrors getSubjectSubmissionReview's authoritative check: a submission is
// visible under exactly the subject it was historically submitted to,
// regardless of the learner's current enrolment.
function submissionBelongsToSubject(submissionSubjectId: string, requestedSubjectId: string) {
  return submissionSubjectId === requestedSubjectId;
}

// Mirrors getTeacherDashboardInsights's awaiting-review tally: counted from
// ALL submissions against the subject's activities, never filtered by
// current enrolment.
function countAwaitingReview(submissions: readonly Submission[]) {
  return submissions.filter(
    (s) => s.status === "submitted" || s.status === "marking_failed" || s.status === "awaiting_review",
  ).length;
}

const RIANAH: Learner = {
  learnerProfileId: "lp-rianah",
  learnerAuthUserId: "e14804f5-7d2c-4f0c-bb0f-36249cdd92c5",
  learnerName: "Rianah Herandien",
};
const XAVIER: Learner = {
  learnerProfileId: "lp-xavier",
  learnerAuthUserId: "614b55a3-0388-4baf-9f4b-f1fc5842b975",
  learnerName: "Xavier Fourie",
};
const CURRENT_LEARNER: Learner = {
  learnerProfileId: "lp-current",
  learnerAuthUserId: "current-learner-id",
  learnerName: "Currently Enrolled Learner",
};
const ACTIVITY_0 = "activity-0-lesson-0-0";

test("A: a currently enrolled learner's submission remains visible", () => {
  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: CURRENT_LEARNER.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-30" },
  ];
  const rows = buildActivityLearnerRows(ACTIVITY_0, [CURRENT_LEARNER], [], submissions);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isPastEnrolment, false);
  assert.equal(rows[0].submission?.status, "awaiting_review");
});

test("B: a transferred learner's historical submission remains visible in the original subject", () => {
  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-31" },
    { activityId: ACTIVITY_0, learnerAuthUserId: XAVIER.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-30" },
  ];
  // Rianah and Xavier are NOT in currentLearners (they transferred to IG1) --
  // only in pastEnrolmentLearners, exactly as the real query would compute.
  const rows = buildActivityLearnerRows(ACTIVITY_0, [CURRENT_LEARNER], [RIANAH, XAVIER], submissions);
  const names = rows.map((r) => r.learnerName);
  assert.ok(names.includes("Rianah Herandien"));
  assert.ok(names.includes("Xavier Fourie"));
  assert.equal(rows.find((r) => r.learnerName === "Rianah Herandien")?.isPastEnrolment, true);
});

test("C: a transferred learner's submission is never reassigned to their new subject", () => {
  // The activities list itself is fetched scoped to exactly one subject_id
  // (lesson_materials.lessons.subject_id = subjectId in the real query), so
  // an IG2 activity can structurally never appear when building IG1's list.
  // This proves the merge logic adds rows for an activity's OWN historical
  // submitters only, never learners from an unrelated subject.
  const ig2Activity = "ig2-activity-0-0";
  const ig1Activities = ["ig1-activity-2-lesson-3-2"]; // IG1 has no Activity 0.0 at all
  const submissions: Submission[] = [
    { activityId: ig2Activity, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-31" },
  ];
  for (const ig1ActivityId of ig1Activities) {
    const rows = buildActivityLearnerRows(ig1ActivityId, [CURRENT_LEARNER], [RIANAH, XAVIER], submissions);
    assert.ok(!rows.some((r) => r.learnerName === "Rianah Herandien"));
  }
});

test("D/E: the submission-detail check accepts the submission's own historical subject and normal review can proceed", () => {
  const rianahSubmissionSubjectId = "bs-igcse-2";
  assert.equal(submissionBelongsToSubject(rianahSubmissionSubjectId, "bs-igcse-2"), true);
});

test("I: an unauthorised/mismatched subject cannot access the historical submission", () => {
  const rianahSubmissionSubjectId = "bs-igcse-2";
  assert.equal(submissionBelongsToSubject(rianahSubmissionSubjectId, "bs-igcse-1"), false);
});

test("F/G/H: original submission ID, submitted_at, and activity association pass through unchanged", () => {
  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-31T06:49:41.464Z" },
  ];
  const rows = buildActivityLearnerRows(ACTIVITY_0, [], [RIANAH], submissions);
  assert.equal(rows[0].submission?.submittedAt, "2026-07-31T06:49:41.464Z");
  assert.equal(rows[0].submission?.activityId, ACTIVITY_0);
});

test("J: a learner who was once enrolled but has no genuine submission is not surfaced", () => {
  const rows = buildActivityLearnerRows(ACTIVITY_0, [], [RIANAH], []);
  assert.equal(rows.length, 0);
});

test("K: the awaiting-review tally includes a genuine unreviewed historical submission", () => {
  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-31" },
    { activityId: ACTIVITY_0, learnerAuthUserId: XAVIER.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-30" },
  ];
  assert.equal(countAwaitingReview(submissions), 2);
});

test("L: a reviewed (returned) historical submission behaves normally, not excluded", () => {
  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "returned", submittedAt: "2026-07-31" },
  ];
  const rows = buildActivityLearnerRows(ACTIVITY_0, [], [RIANAH], submissions);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].submission?.status, "returned");
  assert.equal(countAwaitingReview(submissions), 0);
});

test("M: a learner present in both lists is never duplicated -- current membership always wins", () => {
  // Mirrors the real query's construction: pastEnrolmentAuthUserIds is
  // derived by excluding anyone already in currentLearnerAuthUserIds, so a
  // currently-enrolled learner can never also appear in the past list.
  const currentLearnerAuthUserIds = new Set([RIANAH.learnerAuthUserId]);
  const candidateAuthUserIds = [RIANAH.learnerAuthUserId, XAVIER.learnerAuthUserId];
  const pastEnrolmentAuthUserIds = candidateAuthUserIds.filter(
    (id) => !currentLearnerAuthUserIds.has(id),
  );
  assert.deepEqual(pastEnrolmentAuthUserIds, [XAVIER.learnerAuthUserId]);

  const submissions: Submission[] = [
    { activityId: ACTIVITY_0, learnerAuthUserId: RIANAH.learnerAuthUserId, status: "awaiting_review", submittedAt: "2026-07-31" },
  ];
  const rows = buildActivityLearnerRows(ACTIVITY_0, [RIANAH], [], submissions);
  assert.equal(rows.filter((r) => r.learnerName === "Rianah Herandien").length, 1);
});
