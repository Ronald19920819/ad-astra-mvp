import { calculateDueActivityAcademicAverage } from "@/lib/progress/dueActivityAcademicAverage";
import type {
  MonthlyReportActivityEntry,
  MonthlyReportAcademic,
  MonthlyReportEngagement,
  MonthlyReportEvidenceFlags,
  MonthlyReportLessonEntry,
  MonthlyReportTopicBreakdownEntry,
} from "@/lib/reports/monthlyReportTypes";

// Pure, DOM/DB-free calculations for the Monthly Report. Every function
// here takes already-resolved per-item report entries (the exact shapes
// MonthlyReportPayload exposes) and produces aggregate facts -- none of
// them fetch data or know about Supabase, snapshots, or the legacy due-
// date exceptions; that resolution happens once, upstream, in
// lib/reports/monthlyReportEngine.ts.

type MarkedActivity = MonthlyReportActivityEntry & {
  finalMark: number;
  totalMarks: number;
};

function isMarkedActivity(
  activity: MonthlyReportActivityEntry,
): activity is MarkedActivity {
  return (
    activity.hasAuthoritativeMark &&
    activity.finalMark !== null &&
    activity.totalMarks !== null &&
    activity.totalMarks > 0
  );
}

// EQUAL-WEIGHT average across selected activities -- NEVER weighted by
// raw available marks (a 26-mark activity and a 10-mark activity count
// identically) and NEVER an average of only the returned ones (a missing
// overdue activity contributes 0%, not a silent exclusion). Reuses the
// SAME shared classification/arithmetic the learner dashboard uses (see
// lib/progress/dueActivityAcademicAverage.ts's own header comment for the
// full rule) -- this is the one place both features' academic result is
// computed, never duplicated per subject or per feature.
export function calculateReportAcademicSummary(
  activities: readonly MonthlyReportActivityEntry[],
): Pick<
  MonthlyReportAcademic,
  | "selectedActivityCount"
  | "effectiveActivityCount"
  | "returnedActivityCount"
  | "overdueMissingActivityCount"
  | "awaitingReviewActivityCount"
  | "notYetDueActivityCount"
  | "academicPercentage"
> {
  const result = calculateDueActivityAcademicAverage(
    activities.map((activity) => ({
      hasAuthoritativeMark: activity.hasAuthoritativeMark,
      percentage: activity.percentage,
      submissionStatus: activity.submissionStatus,
      isOverdue: activity.isOverdue,
    })),
  );

  return {
    selectedActivityCount: activities.length,
    effectiveActivityCount: result.effectiveActivityCount,
    returnedActivityCount: result.returnedActivityCount,
    overdueMissingActivityCount: result.overdueMissingActivityCount,
    awaitingReviewActivityCount: result.awaitingReviewActivityCount,
    notYetDueActivityCount: result.notYetDueActivityCount,
    academicPercentage: result.average,
  };
}

// Groups authoritative-marked activities by topic (lesson.topic_id's
// resolved title, already fallen back to the lesson's own title upstream
// when a topic isn't assigned) and applies the SAME weighted (never
// averaged) ratio per topic.
//
// DELIBERATELY uses only genuinely returned/marked activities -- never
// the equal-weight due-activity model above. An unsubmitted or
// awaiting-review activity must never be interpreted as topic-level
// academic weakness; topic analysis reflects actual authoritative
// evidence only, while the overall report academic indicator separately
// reflects selected work + missing work. This distinction is locked and
// matters for later Kingdom commentary (never infer a weak topic from an
// activity that was simply never marked).
export function calculateTopicBreakdown(
  activities: readonly MonthlyReportActivityEntry[],
): MonthlyReportTopicBreakdownEntry[] {
  const markedActivities = activities.filter(isMarkedActivity);

  const groups = new Map<
    string,
    { earnedMarks: number; availableMarks: number; activityCount: number }
  >();
  for (const activity of markedActivities) {
    const topicTitle = activity.topicTitle?.trim() || "Untitled Topic";
    const group = groups.get(topicTitle) ?? {
      earnedMarks: 0,
      availableMarks: 0,
      activityCount: 0,
    };
    group.earnedMarks += activity.finalMark;
    group.availableMarks += activity.totalMarks;
    group.activityCount += 1;
    groups.set(topicTitle, group);
  }

  return [...groups.entries()]
    .map(([topicTitle, group]) => ({
      topicTitle,
      earnedMarks: group.earnedMarks,
      availableMarks: group.availableMarks,
      percentage:
        group.availableMarks > 0
          ? (group.earnedMarks / group.availableMarks) * 100
          : 0,
      activityCount: group.activityCount,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// "Handle it sensibly and transparently rather than dividing by zero":
// averages whichever of the given rates actually exist. Both present ->
// their average. Only one present -> that one, unchanged. None present ->
// null (never 0, which would misrepresent "no data" as "zero engagement").
function averageOfExisting(values: readonly (number | null)[]): number | null {
  const existing = values.filter((value): value is number => value !== null);
  if (existing.length === 0) return null;
  return existing.reduce((sum, value) => sum + value, 0) / existing.length;
}

export function calculateEngagementSummary(
  lessons: readonly MonthlyReportLessonEntry[],
  activities: readonly MonthlyReportActivityEntry[],
): MonthlyReportEngagement {
  const lessonsSelected = lessons.length;
  const lessonsOnTime = lessons.filter((lesson) => lesson.status === "Complete").length;
  const lessonsLate = lessons.filter((lesson) => lesson.status === "Late").length;
  const lessonsCompleted = lessonsOnTime + lessonsLate;
  const lessonsOutstanding = lessons.filter((lesson) => lesson.status === "Overdue").length;

  const activitiesSelected = activities.length;
  const activitiesSubmitted = activities.filter(
    (activity) => activity.submissionStatus !== "not_submitted",
  ).length;
  const activitiesOnTime = activities.filter((activity) => activity.isLate === false).length;
  const activitiesLate = activities.filter((activity) => activity.isLate === true).length;
  const activitiesAwaitingReview = activities.filter(
    (activity) => activity.submissionStatus === "awaiting_review",
  ).length;
  // Deliberately excludes not-yet-due, not-yet-submitted work -- only
  // work that is both unsubmitted AND past its due date/legacy window
  // counts as "outstanding" (see MonthlyReportActivityEntry.isOverdue).
  const activitiesOutstanding = activities.filter(
    (activity) => activity.submissionStatus === "not_submitted" && activity.isOverdue,
  ).length;

  const lessonCompletionRate = lessonsSelected > 0 ? lessonsCompleted / lessonsSelected : null;
  const activitySubmissionRate =
    activitiesSelected > 0 ? activitiesSubmitted / activitiesSelected : null;
  const completionRate = averageOfExisting([lessonCompletionRate, activitySubmissionRate]);

  // Punctuality denominators are "completed/submitted items with a
  // determinable timing basis" -- never outstanding work (that's already
  // reflected in the completion/outstanding metrics above, per the locked
  // "do not double-count outstanding work as late" rule).
  const lessonPunctualityRate = lessonsCompleted > 0 ? lessonsOnTime / lessonsCompleted : null;
  const activitiesWithDeterminableTiming = activities.filter(
    (activity) => activity.isLate !== null,
  ).length;
  const activityPunctualityRate =
    activitiesWithDeterminableTiming > 0
      ? activitiesOnTime / activitiesWithDeterminableTiming
      : null;
  const punctualityRate = averageOfExisting([lessonPunctualityRate, activityPunctualityRate]);

  // The learner/parent-facing "On-Time Work" X/Y figure (see
  // MonthlyReportEngagement's own comment for why this is a SEPARATE
  // figure from punctualityRate above, which stays exactly as-is for the
  // badge). Y = every selected lesson/activity that was genuinely due:
  // completed on time, completed late, or overdue and never completed.
  // "Incomplete" lessons and not-submitted-but-not-yet-overdue activities
  // are genuinely not yet due, so they're excluded from Y entirely, never
  // counted as a missed opportunity. activitiesWithDeterminableTiming
  // already implies "submitted", since isLate is only ever non-null for a
  // submitted-family activity (resolveActivityTiming never resolves a
  // not_submitted item's isLate to anything but null) -- awaiting-review
  // work is included here exactly like any other submitted status,
  // because isLate reflects submission timing, never review timing.
  const onTimeWorkCompletedCount = lessonsOnTime + activitiesOnTime;
  const onTimeWorkDueCount =
    lessonsCompleted + lessonsOutstanding + activitiesWithDeterminableTiming + activitiesOutstanding;

  return {
    lessonsSelected,
    lessonsCompleted,
    lessonsOnTime,
    lessonsLate,
    lessonsOutstanding,
    activitiesSelected,
    activitiesSubmitted,
    activitiesOnTime,
    activitiesLate,
    activitiesAwaitingReview,
    activitiesOutstanding,
    lessonCompletionRate,
    activitySubmissionRate,
    completionRate,
    lessonPunctualityRate,
    activityPunctualityRate,
    punctualityRate,
    onTimeWorkCompletedCount,
    onTimeWorkDueCount,
  };
}

// Locked V1 evidence-safeguard thresholds (AD ASTRA MONTHLY REPORT STAGE
// 1, section 17). These decide only whether Kingdom (a later stage)
// should hedge its language -- they never alter the facts above.
const INSUFFICIENT_MARKED_EVIDENCE_THRESHOLD = 4;
const INSUFFICIENT_FOR_TREND_THRESHOLD = 3;
const LOW_COMPLETION_RATIO_THRESHOLD = 0.5;
// Compound rule (given as the suggested starting rule): either signal
// alone is enough to flag substantial outstanding work -- a learner can
// have a high raw outstanding-activity rate while still looking fine on
// the blended completion rate (many selected items, few outstanding), or
// vice versa (few outstanding activities but weak lesson engagement
// dragging the combined rate down). Using OR catches both shapes of
// concern with one simple, explainable rule rather than requiring a
// second, more complex combined threshold.
const OUTSTANDING_ACTIVITY_RATE_THRESHOLD = 0.3;
const LOW_COMBINED_COMPLETION_THRESHOLD = 0.7;

export function calculateEvidenceFlags({
  activities,
  topicBreakdown,
  engagement,
}: {
  activities: readonly MonthlyReportActivityEntry[];
  topicBreakdown: readonly MonthlyReportTopicBreakdownEntry[];
  engagement: MonthlyReportEngagement;
}): MonthlyReportEvidenceFlags {
  const markedActivityCount = activities.filter(isMarkedActivity).length;

  const insufficientMarkedEvidence =
    markedActivityCount < INSUFFICIENT_MARKED_EVIDENCE_THRESHOLD;
  const insufficientForTrend = markedActivityCount < INSUFFICIENT_FOR_TREND_THRESHOLD;
  const lowCompletionRatio =
    engagement.activitySubmissionRate !== null &&
    engagement.activitySubmissionRate < LOW_COMPLETION_RATIO_THRESHOLD;
  const unreviewedSubmissionsPresent = engagement.activitiesAwaitingReview > 0;

  const selectedTopics = new Set(
    activities
      .map((activity) => activity.topicTitle?.trim())
      .filter((title): title is string => Boolean(title)),
  );
  const topicsWithEvidence = new Set(topicBreakdown.map((topic) => topic.topicTitle));
  const topicCoverageGaps = [...selectedTopics].filter(
    (title) => !topicsWithEvidence.has(title),
  );

  const activityOutstandingRate =
    engagement.activitiesSelected > 0
      ? engagement.activitiesOutstanding / engagement.activitiesSelected
      : 0;
  const substantialOutstandingWork =
    activityOutstandingRate >= OUTSTANDING_ACTIVITY_RATE_THRESHOLD ||
    (engagement.completionRate !== null &&
      engagement.completionRate < LOW_COMBINED_COMPLETION_THRESHOLD);

  return {
    insufficientMarkedEvidence,
    lowCompletionRatio,
    substantialOutstandingWork,
    unreviewedSubmissionsPresent,
    topicCoverageGaps,
    insufficientForTrend,
  };
}
