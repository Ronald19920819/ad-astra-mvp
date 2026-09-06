import {
  MONTHLY_REPORT_SCHEMA_VERSION,
  type DueDateBasis,
  type MonthlyReportActivityEntry,
  type MonthlyReportBadgeKey,
  type MonthlyReportLessonEntry,
  type MonthlyReportPayload,
} from "@/lib/reports/monthlyReportTypes";

// Runtime validation for MonthlyReportPayload, patterned directly after
// lib/activities/activitySnapshot.ts's isActivitySubmissionSnapshot --
// same purpose: a value read back out of jsonb (report_snapshot) must be
// verified before the application trusts its shape, since Postgres jsonb
// enforces no schema of its own.

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

const DUE_DATE_BASIS_VALUES: readonly DueDateBasis[] = [
  "normal",
  "legacy_24h_window_activity_5",
  "legacy_24h_window_activity_2",
];

function isDueDateBasis(value: unknown): value is DueDateBasis {
  return (
    typeof value === "string" &&
    (DUE_DATE_BASIS_VALUES as readonly string[]).includes(value)
  );
}

const LESSON_STATUS_VALUES = ["Complete", "Late", "Incomplete", "Overdue"] as const;

function isLessonEntry(value: unknown): value is MonthlyReportLessonEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.lessonId === "string" &&
    typeof value.lessonNumber === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.topicTitle) &&
    isNullableString(value.dueDate) &&
    isNullableString(value.completedAt) &&
    typeof value.status === "string" &&
    (LESSON_STATUS_VALUES as readonly string[]).includes(value.status)
  );
}

const SUBMISSION_STATUS_VALUES = [
  "not_submitted",
  "submitted",
  "marking_failed",
  "awaiting_review",
  "returned",
] as const;

function isActivityEntry(value: unknown): value is MonthlyReportActivityEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.activityId === "string" &&
    typeof value.lessonId === "string" &&
    typeof value.lessonNumber === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.topicTitle) &&
    isNullableString(value.dueDate) &&
    isDueDateBasis(value.dueDateBasis) &&
    typeof value.submissionStatus === "string" &&
    (SUBMISSION_STATUS_VALUES as readonly string[]).includes(value.submissionStatus) &&
    isNullableString(value.submittedAt) &&
    isNullableBoolean(value.isLate) &&
    isNullableNumber(value.daysLate) &&
    typeof value.isOverdue === "boolean" &&
    typeof value.hasAuthoritativeMark === "boolean" &&
    isNullableNumber(value.finalMark) &&
    isNullableNumber(value.totalMarks) &&
    isNullableNumber(value.percentage)
  );
}

function isTopicBreakdownEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.topicTitle === "string" &&
    typeof value.earnedMarks === "number" &&
    typeof value.availableMarks === "number" &&
    typeof value.percentage === "number" &&
    typeof value.activityCount === "number"
  );
}

function isAcademic(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.selectedActivityCount === "number" &&
    typeof value.effectiveActivityCount === "number" &&
    typeof value.returnedActivityCount === "number" &&
    typeof value.overdueMissingActivityCount === "number" &&
    typeof value.awaitingReviewActivityCount === "number" &&
    typeof value.notYetDueActivityCount === "number" &&
    isNullableNumber(value.academicPercentage) &&
    Array.isArray(value.topicBreakdown) &&
    value.topicBreakdown.every(isTopicBreakdownEntry)
  );
}

const ENGAGEMENT_NUMERIC_FIELDS = [
  "lessonsSelected",
  "lessonsCompleted",
  "lessonsOnTime",
  "lessonsLate",
  "lessonsOutstanding",
  "activitiesSelected",
  "activitiesSubmitted",
  "activitiesOnTime",
  "activitiesLate",
  "activitiesAwaitingReview",
  "activitiesOutstanding",
  "onTimeWorkCompletedCount",
  "onTimeWorkDueCount",
] as const;

const ENGAGEMENT_NULLABLE_RATE_FIELDS = [
  "lessonCompletionRate",
  "activitySubmissionRate",
  "completionRate",
  "lessonPunctualityRate",
  "activityPunctualityRate",
  "punctualityRate",
] as const;

function isEngagement(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    ENGAGEMENT_NUMERIC_FIELDS.every((field) => typeof value[field] === "number") &&
    ENGAGEMENT_NULLABLE_RATE_FIELDS.every((field) => isNullableNumber(value[field]))
  );
}

function isEvidenceFlags(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.insufficientMarkedEvidence === "boolean" &&
    typeof value.lowCompletionRatio === "boolean" &&
    typeof value.substantialOutstandingWork === "boolean" &&
    typeof value.unreviewedSubmissionsPresent === "boolean" &&
    typeof value.insufficientForTrend === "boolean" &&
    Array.isArray(value.topicCoverageGaps) &&
    value.topicCoverageGaps.every((title) => typeof title === "string")
  );
}

const BADGE_KEY_VALUES: readonly MonthlyReportBadgeKey[] = [
  "stellar",
  "on_course",
  "course_correction",
];

function isBadge(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    (BADGE_KEY_VALUES as readonly string[]).includes(value.key) &&
    typeof value.academicThresholdPassed === "boolean" &&
    typeof value.completionThresholdPassed === "boolean" &&
    typeof value.punctualityThresholdPassed === "boolean" &&
    typeof value.sufficientEvidence === "boolean"
  );
}

function isMeta(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.learnerId === "string" &&
    typeof value.learnerName === "string" &&
    typeof value.subjectId === "string" &&
    typeof value.subjectName === "string" &&
    typeof value.teacherId === "string" &&
    isNullableString(value.teacherName) &&
    typeof value.reportMonth === "string" &&
    typeof value.generatedAt === "string"
  );
}

export function isMonthlyReportPayload(
  value: unknown,
): value is MonthlyReportPayload {
  if (!isRecord(value)) return false;

  return (
    value.schemaVersion === MONTHLY_REPORT_SCHEMA_VERSION &&
    isMeta(value.meta) &&
    Array.isArray(value.lessons) &&
    value.lessons.every(isLessonEntry) &&
    Array.isArray(value.activities) &&
    value.activities.every(isActivityEntry) &&
    isAcademic(value.academic) &&
    isEngagement(value.engagement) &&
    isEvidenceFlags(value.evidenceFlags) &&
    isBadge(value.badge) &&
    value.attendance === null
  );
}
