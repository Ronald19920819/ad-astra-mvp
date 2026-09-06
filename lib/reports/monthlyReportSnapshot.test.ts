import assert from "node:assert/strict";
import test from "node:test";

import { isMonthlyReportPayload } from "./monthlyReportSnapshot";
import type { MonthlyReportPayload } from "./monthlyReportTypes";

function validPayload(): MonthlyReportPayload {
  return {
    schemaVersion: 1,
    meta: {
      learnerId: "learner-1",
      learnerName: "Ethan Learner",
      subjectId: "subject-1",
      subjectName: "Business Studies",
      teacherId: "teacher-1",
      teacherName: "Ronald Petersen",
      reportMonth: "2026-08-01",
      generatedAt: "2026-09-01T00:00:00.000Z",
    },
    lessons: [
      {
        lessonId: "lesson-1",
        lessonNumber: "3.1",
        title: "Niche Marketing",
        topicTitle: "Marketing",
        dueDate: "2026-08-04",
        completedAt: "2026-08-03T10:00:00.000Z",
        status: "Complete",
      },
    ],
    activities: [
      {
        activityId: "activity-1",
        lessonId: "lesson-1",
        lessonNumber: "3.1",
        title: "Activity 1",
        topicTitle: "Marketing",
        dueDate: "2026-08-04",
        dueDateBasis: "normal",
        submissionStatus: "returned",
        submittedAt: "2026-08-03T10:00:00.000Z",
        isLate: false,
        daysLate: 0,
        isOverdue: false,
        hasAuthoritativeMark: true,
        finalMark: 8,
        totalMarks: 10,
        percentage: 80,
      },
    ],
    academic: {
      selectedActivityCount: 1,
      effectiveActivityCount: 1,
      returnedActivityCount: 1,
      overdueMissingActivityCount: 0,
      awaitingReviewActivityCount: 0,
      notYetDueActivityCount: 0,
      academicPercentage: 80,
      topicBreakdown: [
        { topicTitle: "Marketing", earnedMarks: 8, availableMarks: 10, percentage: 80, activityCount: 1 },
      ],
    },
    engagement: {
      lessonsSelected: 1,
      lessonsCompleted: 1,
      lessonsOnTime: 1,
      lessonsLate: 0,
      lessonsOutstanding: 0,
      activitiesSelected: 1,
      activitiesSubmitted: 1,
      activitiesOnTime: 1,
      activitiesLate: 0,
      activitiesAwaitingReview: 0,
      activitiesOutstanding: 0,
      lessonCompletionRate: 1,
      activitySubmissionRate: 1,
      completionRate: 1,
      lessonPunctualityRate: 1,
      activityPunctualityRate: 1,
      punctualityRate: 1,
      onTimeWorkCompletedCount: 2,
      onTimeWorkDueCount: 2,
    },
    evidenceFlags: {
      insufficientMarkedEvidence: true,
      lowCompletionRatio: false,
      substantialOutstandingWork: false,
      unreviewedSubmissionsPresent: false,
      topicCoverageGaps: [],
      insufficientForTrend: true,
    },
    badge: {
      key: "course_correction",
      academicThresholdPassed: true,
      completionThresholdPassed: true,
      punctualityThresholdPassed: true,
      sufficientEvidence: false,
    },
    attendance: null,
  };
}

test("a genuine, fully-formed payload is accepted", () => {
  assert.equal(isMonthlyReportPayload(validPayload()), true);
});

test("rejects a payload with the wrong schema version", () => {
  const payload = { ...validPayload(), schemaVersion: 2 };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload with a malformed lesson status", () => {
  const payload = validPayload();
  payload.lessons[0] = { ...payload.lessons[0], status: "InProgress" as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload with an invalid dueDateBasis", () => {
  const payload = validPayload();
  payload.activities[0] = { ...payload.activities[0], dueDateBasis: "made_up_basis" as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload with an invalid submissionStatus", () => {
  const payload = validPayload();
  payload.activities[0] = { ...payload.activities[0], submissionStatus: "graded" as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload with an invalid badge key", () => {
  const payload = validPayload();
  payload.badge = { ...payload.badge, key: "gold_star" as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload where attendance is not null", () => {
  const payload = { ...validPayload(), attendance: { sessionsAttended: 3 } as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a payload missing the academic section entirely", () => {
  const payload = validPayload() as Record<string, unknown>;
  delete payload.academic;
  assert.equal(isMonthlyReportPayload(payload), false);
});

test("rejects a bare non-object value", () => {
  assert.equal(isMonthlyReportPayload(null), false);
  assert.equal(isMonthlyReportPayload("not a report"), false);
  assert.equal(isMonthlyReportPayload(42), false);
  assert.equal(isMonthlyReportPayload([]), false);
});

test("accepts a lesson/activity with a null topicTitle (no topic assigned, lesson-title fallback already resolved upstream)", () => {
  const payload = validPayload();
  payload.lessons[0] = { ...payload.lessons[0], topicTitle: null };
  payload.activities[0] = { ...payload.activities[0], topicTitle: null };
  assert.equal(isMonthlyReportPayload(payload), true);
});

test("accepts a null teacherName -- a best-effort display name that may genuinely be unresolvable, never fabricated", () => {
  const payload = validPayload();
  payload.meta = { ...payload.meta, teacherName: null };
  assert.equal(isMonthlyReportPayload(payload), true);
});

test("rejects a payload where teacherName is present but not a string or null", () => {
  const payload = validPayload();
  payload.meta = { ...payload.meta, teacherName: 42 as never };
  assert.equal(isMonthlyReportPayload(payload), false);
});
