import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEngagementSummary,
  calculateEvidenceFlags,
  calculateReportAcademicSummary,
  calculateTopicBreakdown,
} from "./monthlyReportCalculations";
import type {
  MonthlyReportActivityEntry,
  MonthlyReportLessonEntry,
} from "./monthlyReportTypes";

function activity(
  overrides: Partial<MonthlyReportActivityEntry> = {},
): MonthlyReportActivityEntry {
  return {
    activityId: "activity-1",
    lessonId: "lesson-1",
    lessonNumber: "3.1",
    title: "Activity 1",
    topicTitle: "Topic A",
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
    ...overrides,
  };
}

function lesson(overrides: Partial<MonthlyReportLessonEntry> = {}): MonthlyReportLessonEntry {
  return {
    lessonId: "lesson-1",
    lessonNumber: "3.1",
    title: "Lesson 3.1",
    topicTitle: "Topic A",
    dueDate: "2026-08-04",
    completedAt: "2026-08-03T10:00:00.000Z",
    status: "Complete",
    ...overrides,
  };
}

function overdueMissingActivity(overrides: Partial<MonthlyReportActivityEntry> = {}): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "not_submitted",
    submittedAt: null,
    isLate: null,
    daysLate: null,
    isOverdue: true,
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

function notYetDueActivity(overrides: Partial<MonthlyReportActivityEntry> = {}): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "not_submitted",
    submittedAt: null,
    isLate: null,
    daysLate: null,
    isOverdue: false,
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

function awaitingReviewActivity(overrides: Partial<MonthlyReportActivityEntry> = {}): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "awaiting_review",
    isLate: null,
    daysLate: null,
    isOverdue: false,
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

test("Example A: 10 selected, 1 returned at 38%, 9 overdue/unsubmitted -> 3.8%, never marks-weighted", () => {
  const activities = [
    activity({ activityId: "a1", percentage: 38 }),
    ...Array.from({ length: 9 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const summary = calculateReportAcademicSummary(activities);
  assert.equal(summary.selectedActivityCount, 10);
  assert.equal(summary.effectiveActivityCount, 10);
  assert.equal(summary.returnedActivityCount, 1);
  assert.equal(summary.overdueMissingActivityCount, 9);
  assert.ok(Math.abs(summary.academicPercentage! - 3.8) < 1e-9);
});

test("Example B: 10 selected, 2 returned (80%, 70%) + 8 missing -> 15%, equal weight regardless of raw marks", () => {
  const activities = [
    activity({ activityId: "a1", percentage: 80, finalMark: 8, totalMarks: 10 }),
    activity({ activityId: "a2", percentage: 70, finalMark: 14, totalMarks: 20 }),
    ...Array.from({ length: 8 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const summary = calculateReportAcademicSummary(activities);
  assert.equal(summary.academicPercentage, 15);
});

test("Example C: 8 returned averaging 80% + 1 awaiting review + 1 overdue missing -> effective denominator is 9", () => {
  const activities = [
    ...Array.from({ length: 8 }, (_, index) => activity({ activityId: `returned-${index}`, percentage: 80 })),
    awaitingReviewActivity({ activityId: "pending" }),
    overdueMissingActivity({ activityId: "missing" }),
  ];
  const summary = calculateReportAcademicSummary(activities);
  assert.equal(summary.selectedActivityCount, 10);
  assert.equal(summary.effectiveActivityCount, 9);
  assert.equal(summary.returnedActivityCount, 8);
  assert.equal(summary.overdueMissingActivityCount, 1);
  assert.equal(summary.awaitingReviewActivityCount, 1);
  assert.ok(Math.abs(summary.academicPercentage! - 640 / 9) < 1e-9);
});

test("Example D: a selected future-due (Not Yet Due), unsubmitted activity never reduces the academic average", () => {
  const activities = [
    activity({ activityId: "a1", percentage: 90 }),
    notYetDueActivity({ activityId: "future" }),
  ];
  const summary = calculateReportAcademicSummary(activities);
  assert.equal(summary.selectedActivityCount, 2);
  assert.equal(summary.effectiveActivityCount, 1);
  assert.equal(summary.notYetDueActivityCount, 1);
  assert.equal(summary.academicPercentage, 90);
});

test("equal weighting is independent of raw total marks -- a 26-mark and a 10-mark activity count identically", () => {
  const activities = [
    activity({ activityId: "a1", percentage: 100, finalMark: 26, totalMarks: 26 }),
    activity({ activityId: "a2", percentage: 0, finalMark: 0, totalMarks: 10 }),
  ];
  const summary = calculateReportAcademicSummary(activities);
  assert.equal(summary.academicPercentage, 50);
});

test("returns null academic percentage with zero effective activities, never NaN or 0", () => {
  const summary = calculateReportAcademicSummary([]);
  assert.equal(summary.academicPercentage, null);
  assert.equal(summary.effectiveActivityCount, 0);
});

test("topic breakdown aggregates weighted marks per topic, never averaged percentages", () => {
  const activities = [
    activity({ activityId: "a1", topicTitle: "Marketing Mix", finalMark: 5, totalMarks: 10 }),
    activity({ activityId: "a2", topicTitle: "Marketing Mix", finalMark: 15, totalMarks: 20 }),
    activity({ activityId: "a3", topicTitle: "Pricing", finalMark: 9, totalMarks: 10 }),
  ];
  const breakdown = calculateTopicBreakdown(activities);
  const marketingMix = breakdown.find((entry) => entry.topicTitle === "Marketing Mix");
  assert.ok(marketingMix);
  assert.equal(marketingMix!.earnedMarks, 20);
  assert.equal(marketingMix!.availableMarks, 30);
  assert.ok(Math.abs(marketingMix!.percentage - 66.666666) < 0.001);
  assert.equal(marketingMix!.activityCount, 2);

  const pricing = breakdown.find((entry) => entry.topicTitle === "Pricing");
  assert.equal(pricing!.percentage, 90);
});

test("topic breakdown ignores activities with no authoritative mark", () => {
  const activities = [
    activity({ topicTitle: "Topic A", hasAuthoritativeMark: false, finalMark: null, totalMarks: null }),
  ];
  assert.deepEqual(calculateTopicBreakdown(activities), []);
});

test("engagement: lesson completion/on-time/late/outstanding are derived from status alone", () => {
  const lessons = [
    lesson({ lessonId: "l1", status: "Complete" }),
    lesson({ lessonId: "l2", status: "Late" }),
    lesson({ lessonId: "l3", status: "Overdue" }),
    lesson({ lessonId: "l4", status: "Incomplete" }),
  ];
  const summary = calculateEngagementSummary(lessons, []);
  assert.equal(summary.lessonsSelected, 4);
  assert.equal(summary.lessonsCompleted, 2); // Complete + Late
  assert.equal(summary.lessonsOnTime, 1);
  assert.equal(summary.lessonsLate, 1);
  assert.equal(summary.lessonsOutstanding, 1);
});

test("engagement: awaiting_review counts as submitted for completion, and never as academically marked", () => {
  const activities = [
    activity({ activityId: "a1", submissionStatus: "awaiting_review", hasAuthoritativeMark: false, finalMark: null, totalMarks: null, isLate: null, daysLate: null }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.activitiesSelected, 1);
  assert.equal(summary.activitiesSubmitted, 1);
  assert.equal(summary.activitiesAwaitingReview, 1);
  const academic = calculateReportAcademicSummary(activities);
  assert.equal(academic.returnedActivityCount, 0);
  assert.equal(academic.awaitingReviewActivityCount, 1);
});

test("LOCKED: outstanding (never-submitted) selected work remains present in activitiesSelected -- it is never filtered out of report scope just because it wasn't completed", () => {
  const activities = [
    activity({
      activityId: "outstanding-1",
      submissionStatus: "not_submitted",
      submittedAt: null,
      isLate: null,
      daysLate: null,
      isOverdue: true,
      hasAuthoritativeMark: false,
      finalMark: null,
      totalMarks: null,
      percentage: null,
    }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.activitiesSelected, 1); // still counted as selected, not dropped
  assert.equal(summary.activitiesSubmitted, 0);
  assert.equal(summary.activitiesOutstanding, 1);
});

test("engagement: not_submitted-and-overdue counts as outstanding; not_submitted-but-not-yet-due does not", () => {
  const activities = [
    activity({ activityId: "a1", submissionStatus: "not_submitted", submittedAt: null, isLate: null, daysLate: null, isOverdue: true, hasAuthoritativeMark: false, finalMark: null, totalMarks: null }),
    activity({ activityId: "a2", submissionStatus: "not_submitted", submittedAt: null, isLate: null, daysLate: null, isOverdue: false, hasAuthoritativeMark: false, finalMark: null, totalMarks: null }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.activitiesOutstanding, 1);
  assert.equal(summary.activitiesSubmitted, 0);
});

test("engagement rates never divide by zero -- null when nothing is selected in that dimension", () => {
  const summary = calculateEngagementSummary([], []);
  assert.equal(summary.lessonCompletionRate, null);
  assert.equal(summary.activitySubmissionRate, null);
  assert.equal(summary.completionRate, null);
  assert.equal(summary.lessonPunctualityRate, null);
  assert.equal(summary.activityPunctualityRate, null);
  assert.equal(summary.punctualityRate, null);
});

test("combined completion rate uses whichever single dimension exists when the other has zero selected items", () => {
  const activities = [activity({ submissionStatus: "returned" })];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.lessonCompletionRate, null);
  assert.equal(summary.activitySubmissionRate, 1);
  assert.equal(summary.completionRate, 1); // falls back to the one existing rate, not divided by 2
});

test("a learner who ignores every selected lesson but submits every selected activity cannot reach a high combined completion rate", () => {
  const lessons = [
    lesson({ lessonId: "l1", status: "Incomplete" }),
    lesson({ lessonId: "l2", status: "Incomplete" }),
  ];
  const activities = [
    activity({ activityId: "a1", submissionStatus: "returned" }),
    activity({ activityId: "a2", submissionStatus: "returned" }),
  ];
  const summary = calculateEngagementSummary(lessons, activities);
  assert.equal(summary.lessonCompletionRate, 0);
  assert.equal(summary.activitySubmissionRate, 1);
  assert.equal(summary.completionRate, 0.5); // averaged down, not just the activity side
});

test("combined completion rate averages both dimensions when both exist", () => {
  const lessons = [lesson({ status: "Complete" }), lesson({ lessonId: "l2", status: "Incomplete" })];
  const activities = [activity({ submissionStatus: "returned" })];
  const summary = calculateEngagementSummary(lessons, activities);
  assert.equal(summary.lessonCompletionRate, 0.5);
  assert.equal(summary.activitySubmissionRate, 1);
  assert.equal(summary.completionRate, 0.75);
});

test("activity punctuality rate excludes items with indeterminate timing (isLate === null) from its denominator", () => {
  const activities = [
    activity({ activityId: "a1", isLate: false }),
    activity({ activityId: "a2", isLate: true }),
    activity({ activityId: "a3", submissionStatus: "not_submitted", submittedAt: null, isLate: null, daysLate: null, hasAuthoritativeMark: false, finalMark: null, totalMarks: null }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.activityPunctualityRate, 0.5); // 1 on-time of 2 determinable, not of 3
});

test("evidence flags: insufficientMarkedEvidence and insufficientForTrend use the locked thresholds", () => {
  const twoMarked = [
    activity({ activityId: "a1" }),
    activity({ activityId: "a2" }),
  ];
  const engagement = calculateEngagementSummary([], twoMarked);
  const topicBreakdown = calculateTopicBreakdown(twoMarked);
  const flags = calculateEvidenceFlags({ activities: twoMarked, topicBreakdown, engagement });
  assert.equal(flags.insufficientMarkedEvidence, true); // 2 < 4
  assert.equal(flags.insufficientForTrend, true); // 2 < 3
});

test("evidence flags: exactly 4 marked activities (the locked minimum) is sufficient, never flagged insufficient", () => {
  const fourMarked = [
    activity({ activityId: "a1" }),
    activity({ activityId: "a2" }),
    activity({ activityId: "a3" }),
    activity({ activityId: "a4" }),
  ];
  const engagement = calculateEngagementSummary([], fourMarked);
  const topicBreakdown = calculateTopicBreakdown(fourMarked);
  const flags = calculateEvidenceFlags({ activities: fourMarked, topicBreakdown, engagement });
  assert.equal(flags.insufficientMarkedEvidence, false);
});

test("evidence flags: unreviewedSubmissionsPresent is true only when an awaiting_review activity is selected", () => {
  const activities = [
    activity({ submissionStatus: "awaiting_review", hasAuthoritativeMark: false, finalMark: null, totalMarks: null, isLate: null, daysLate: null }),
  ];
  const engagement = calculateEngagementSummary([], activities);
  const flags = calculateEvidenceFlags({ activities, topicBreakdown: [], engagement });
  assert.equal(flags.unreviewedSubmissionsPresent, true);
});

test("evidence flags: topicCoverageGaps lists selected topics with zero authoritative marked evidence", () => {
  const activities = [
    activity({ topicTitle: "Marketing Mix", hasAuthoritativeMark: true }),
    activity({ activityId: "a2", topicTitle: "Pricing", hasAuthoritativeMark: false, finalMark: null, totalMarks: null, submissionStatus: "not_submitted", submittedAt: null, isLate: null, daysLate: null }),
  ];
  const topicBreakdown = calculateTopicBreakdown(activities);
  const engagement = calculateEngagementSummary([], activities);
  const flags = calculateEvidenceFlags({ activities, topicBreakdown, engagement });
  assert.deepEqual(flags.topicCoverageGaps, ["Pricing"]);
});

test("evidence flags: substantialOutstandingWork fires when the outstanding-activity rate is >= 30%", () => {
  const activities = [
    activity({ activityId: "a1", submissionStatus: "not_submitted", submittedAt: null, isLate: null, daysLate: null, isOverdue: true, hasAuthoritativeMark: false, finalMark: null, totalMarks: null }),
    activity({ activityId: "a2" }),
    activity({ activityId: "a3" }),
  ];
  const engagement = calculateEngagementSummary([], activities);
  const topicBreakdown = calculateTopicBreakdown(activities);
  const flags = calculateEvidenceFlags({ activities, topicBreakdown, engagement });
  assert.equal(flags.substantialOutstandingWork, true); // 1/3 = 33% >= 30%
});

// AD ASTRA ON-TIME WORK DISPLAY CORRECTION -- the learner/parent-facing
// "On-Time Work" figure must be a volume (X of Y), never a percentage.
// punctualityRate's denominator only counts completed/submitted items
// with determinable timing, which silently drops outstanding/overdue-
// missing work entirely -- these tests cover the SEPARATE
// onTimeWorkCompletedCount/onTimeWorkDueCount fields introduced to fix
// that, while punctualityRate itself is left completely unchanged (still
// consumed by calculateMonthlyReportBadge).

test("1 on-time + 9 overdue missing -> 1 / 10, not the misleading 100% punctualityRate would otherwise imply", () => {
  const activities = [
    activity({ activityId: "on-time", isLate: false }),
    ...Array.from({ length: 9 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.onTimeWorkCompletedCount, 1);
  assert.equal(summary.onTimeWorkDueCount, 10);
  // The internal rate this display deliberately does NOT use, to prove
  // the bug this correction fixes actually exists before the fix.
  assert.equal(summary.activityPunctualityRate, 1);
});

test("8 on-time + 2 late -> 8 / 10", () => {
  const activities = [
    ...Array.from({ length: 8 }, (_, index) => activity({ activityId: `ontime-${index}`, isLate: false })),
    ...Array.from({ length: 2 }, (_, index) => activity({ activityId: `late-${index}`, isLate: true, daysLate: 2 })),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.onTimeWorkCompletedCount, 8);
  assert.equal(summary.onTimeWorkDueCount, 10);
});

test("Not Yet Due items are excluded from the on-time-work denominator entirely, never counted as a missed opportunity", () => {
  const activities = [
    activity({ activityId: "on-time", isLate: false }),
    notYetDueActivity({ activityId: "future-1" }),
    notYetDueActivity({ activityId: "future-2" }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.onTimeWorkCompletedCount, 1);
  assert.equal(summary.onTimeWorkDueCount, 1); // the two not-yet-due items never enter Y
});

test("awaiting-review submitted work is classified by its submission timing, never its review timing", () => {
  const activities = [
    // Submitted on time but still awaiting teacher review -- must count
    // as on-time work now, not be held back until it's reviewed.
    awaitingReviewActivity({ activityId: "pending-on-time", isLate: false }),
    // Submitted late, also still awaiting review -- must count toward Y
    // (it was due and submitted) but not toward X.
    awaitingReviewActivity({ activityId: "pending-late", isLate: true, daysLate: 3 }),
  ];
  const summary = calculateEngagementSummary([], activities);
  assert.equal(summary.onTimeWorkCompletedCount, 1);
  assert.equal(summary.onTimeWorkDueCount, 2);
});

test("no due eligible work (everything selected is Not Yet Due) -> onTimeWorkDueCount is 0, a genuinely different state from '0 on time out of some due count'", () => {
  const activities = [
    notYetDueActivity({ activityId: "future-1" }),
    notYetDueActivity({ activityId: "future-2" }),
  ];
  const lessons = [lesson({ status: "Incomplete" })];
  const summary = calculateEngagementSummary(lessons, activities);
  assert.equal(summary.onTimeWorkCompletedCount, 0);
  assert.equal(summary.onTimeWorkDueCount, 0);
});

test("the reported example: two on-time completed lessons + one on-time returned activity + mostly overdue selected work -- combined on-time volume reflects the true 3-of-N picture, not the 100% punctualityRate would otherwise show", () => {
  const lessons = [
    lesson({ lessonId: "l1", status: "Complete" }),
    lesson({ lessonId: "l2", status: "Complete" }),
    ...Array.from({ length: 8 }, (_, index) => lesson({ lessonId: `future-l${index}`, status: "Incomplete" })),
  ];
  const activities = [
    activity({ activityId: "returned", isLate: false }),
    ...Array.from({ length: 9 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const summary = calculateEngagementSummary(lessons, activities);
  // The old, misleading combined rate this report actually showed.
  assert.equal(summary.punctualityRate, 1);
  // The new, honest volume: 2 on-time lessons + 1 on-time activity, out
  // of 2 due lessons + 10 due activities.
  assert.equal(summary.onTimeWorkCompletedCount, 3);
  assert.equal(summary.onTimeWorkDueCount, 12);
});

test("evidence flags: substantialOutstandingWork also fires when the combined completion rate is < 70%, even with zero outstanding activities", () => {
  const lessons = [lesson({ status: "Incomplete" }), lesson({ lessonId: "l2", status: "Incomplete" })];
  const activities = [activity({ submissionStatus: "returned" })];
  const engagement = calculateEngagementSummary(lessons, activities);
  const topicBreakdown = calculateTopicBreakdown(activities);
  const flags = calculateEvidenceFlags({ activities, topicBreakdown, engagement });
  assert.ok(engagement.completionRate! < 0.7);
  assert.equal(flags.substantialOutstandingWork, true);
});
