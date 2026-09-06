import type { LearnerActivitySubmissionStatus } from "@/lib/activities/learnerActivityStatus";
import type { TrackerLessonStatus } from "@/lib/supabase/learningTrackerReader";

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 1: deterministic types only.
// Everything here is calculated by application/database logic BEFORE
// Kingdom ever sees it. Kingdom (a later stage) may interpret this
// payload, but must never determine completion, lateness, marks,
// percentages, due dates, selection, rates, evidence sufficiency, or the
// badge -- all of that is fixed by the time this payload exists.

export const MONTHLY_REPORT_SCHEMA_VERSION = 1 as const;

export type DueDateBasis =
  | "normal"
  | "legacy_24h_window_activity_5"
  | "legacy_24h_window_activity_2";

// Reuses the exact enum already established for teacher/report-facing
// lesson status (lib/supabase/learningTrackerReader.ts's
// TrackerLessonStatus) rather than inventing a parallel one.
export type LessonReportStatus = TrackerLessonStatus;

export type ActivityReportSubmissionStatus =
  | "not_submitted"
  | LearnerActivitySubmissionStatus;

export type MonthlyReportLessonEntry = {
  lessonId: string;
  lessonNumber: string;
  title: string;
  topicTitle: string | null;
  dueDate: string | null;
  completedAt: string | null;
  status: LessonReportStatus;
};

export type MonthlyReportActivityEntry = {
  activityId: string;
  lessonId: string;
  lessonNumber: string;
  title: string;
  topicTitle: string | null;
  dueDate: string | null;
  dueDateBasis: DueDateBasis;
  submissionStatus: ActivityReportSubmissionStatus;
  submittedAt: string | null;
  // null whenever timing cannot be determined for this item (not
  // submitted, or a legacy-exception activity whose 24h window has never
  // been anchored by a genuine platform-wide submission yet).
  isLate: boolean | null;
  daysLate: number | null;
  // Meaningful only when submissionStatus === "not_submitted": true when
  // this activity's due date/legacy window has already passed with no
  // submission. Always false once submitted (a submitted item is no
  // longer "outstanding", regardless of how late it was).
  isOverdue: boolean;
  hasAuthoritativeMark: boolean;
  finalMark: number | null;
  totalMarks: number | null;
  percentage: number | null;
};

export type MonthlyReportTopicBreakdownEntry = {
  topicTitle: string;
  earnedMarks: number;
  availableMarks: number;
  percentage: number;
  activityCount: number;
};

// AD ASTRA ACADEMIC AVERAGE MODEL CORRECTION: the report academic result
// is an EQUAL-WEIGHT average across the teacher's selected graded
// activities, never a marks-weighted one -- a 26-mark activity and a
// 10-mark activity count identically. Every selected activity is
// classified into exactly one of the five counts below (see
// lib/progress/dueActivityAcademicAverage.ts for the shared rule this
// mirrors); academicPercentage is the arithmetic mean over
// effectiveActivityCount, deliberately excluding awaitingReview and
// notYetDue activities from BOTH the numerator and the denominator.
export type MonthlyReportAcademic = {
  selectedActivityCount: number;
  // returnedActivityCount + overdueMissingActivityCount -- the actual
  // denominator behind academicPercentage.
  effectiveActivityCount: number;
  returnedActivityCount: number;
  overdueMissingActivityCount: number;
  // Any submitted-but-not-yet-teacher-finalised status (submitted,
  // marking_failed, awaiting_review) -- temporarily neutral, never
  // penalised for a teacher-side delay.
  awaitingReviewActivityCount: number;
  // Selected but genuinely not yet due and unsubmitted -- the teacher may
  // select future work, but it must never reduce the academic result.
  notYetDueActivityCount: number;
  academicPercentage: number | null;
  // Topic breakdown deliberately uses ONLY authoritative returned marks
  // (never the equal-weight model above) -- see calculateTopicBreakdown's
  // own header comment for why this distinction is locked.
  topicBreakdown: MonthlyReportTopicBreakdownEntry[];
};

export type MonthlyReportEngagement = {
  lessonsSelected: number;
  lessonsCompleted: number;
  lessonsOnTime: number;
  lessonsLate: number;
  lessonsOutstanding: number;

  activitiesSelected: number;
  activitiesSubmitted: number;
  activitiesOnTime: number;
  activitiesLate: number;
  activitiesAwaitingReview: number;
  activitiesOutstanding: number;

  lessonCompletionRate: number | null;
  activitySubmissionRate: number | null;
  completionRate: number | null;

  // Internal rates only -- kept for the Stellar/On Course/Course
  // Correction badge calculation (calculateMonthlyReportBadge consumes
  // punctualityRate directly). Their denominators exclude outstanding/
  // overdue-missing work (only completed/submitted items with a
  // determinable timing basis count), which is exactly right for a
  // completion-based badge signal but reads as misleadingly high on a
  // learner/parent-facing display when most selected work is simply
  // missing -- see onTimeWorkCompletedCount/onTimeWorkDueCount below for
  // the report's actual "On-Time Work" display value.
  lessonPunctualityRate: number | null;
  activityPunctualityRate: number | null;
  punctualityRate: number | null;

  // The learner/parent-facing "On-Time Work" figure: X of Y, never a
  // percentage. Y is every selected lesson/activity that was genuinely
  // due (completed on time, completed late, or overdue and never
  // completed) -- Not Yet Due items are excluded, but unlike
  // punctualityRate above, overdue/outstanding work IS included in Y
  // (contributing 0 to X) because it was due and could reasonably have
  // been completed on time. X is the subset of Y actually completed/
  // submitted on time.
  onTimeWorkCompletedCount: number;
  onTimeWorkDueCount: number;
};

export type MonthlyReportEvidenceFlags = {
  insufficientMarkedEvidence: boolean;
  lowCompletionRatio: boolean;
  substantialOutstandingWork: boolean;
  unreviewedSubmissionsPresent: boolean;
  topicCoverageGaps: string[];
  insufficientForTrend: boolean;
};

export type MonthlyReportBadgeKey = "stellar" | "on_course" | "course_correction";

export type MonthlyReportBadge = {
  key: MonthlyReportBadgeKey;
  academicThresholdPassed: boolean;
  completionThresholdPassed: boolean;
  punctualityThresholdPassed: boolean;
  sufficientEvidence: boolean;
};

export type MonthlyReportPayload = {
  schemaVersion: typeof MONTHLY_REPORT_SCHEMA_VERSION;
  meta: {
    learnerId: string;
    learnerName: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    // Best-effort display name, resolved directly from profiles.id (the
    // same identity space teacher_id lives in -- see the reviewed_by
    // convention). Null when the profile can't be resolved -- never
    // fabricated. A future mentor-teacher field is a SEPARATE person; see
    // this stage's report for what mentor architecture currently exists.
    teacherName: string | null;
    reportMonth: string;
    generatedAt: string;
  };
  lessons: MonthlyReportLessonEntry[];
  activities: MonthlyReportActivityEntry[];
  academic: MonthlyReportAcademic;
  engagement: MonthlyReportEngagement;
  evidenceFlags: MonthlyReportEvidenceFlags;
  badge: MonthlyReportBadge;
  // Reserved for a future Live Lessons stage -- always null in V1.
  attendance: null;
};
