export type MarkedActivityScore = {
  earnedMarks: number;
  availableMarks: number;
};

export type SubjectProgressCalculation = {
  overallMark: number | null;
  activityAverage: number | null;
  activityEarnedMarks: number;
  activityAvailableMarks: number;
  lessonCompletionPercentage: number;
  completedLessonCount: number;
  totalPublishedLessonCount: number;
  hasMarkedActivities: boolean;
};

export function calculateSubjectProgress({
  markedActivities,
  completedLessonCount,
  totalPublishedLessonCount,
}: {
  markedActivities: MarkedActivityScore[];
  completedLessonCount: number;
  totalPublishedLessonCount: number;
}): SubjectProgressCalculation {
  const validActivities = markedActivities.filter(
    ({ earnedMarks, availableMarks }) =>
      Number.isFinite(earnedMarks) &&
      Number.isFinite(availableMarks) &&
      earnedMarks >= 0 &&
      availableMarks > 0 &&
      earnedMarks <= availableMarks,
  );
  const activityEarnedMarks = validActivities.reduce(
    (total, activity) => total + activity.earnedMarks,
    0,
  );
  const activityAvailableMarks = validActivities.reduce(
    (total, activity) => total + activity.availableMarks,
    0,
  );
  const safeTotalLessons = Math.max(0, totalPublishedLessonCount);
  const safeCompletedLessons = Math.min(
    Math.max(0, completedLessonCount),
    safeTotalLessons,
  );
  const lessonCompletionPercentage =
    safeTotalLessons > 0
      ? (safeCompletedLessons / safeTotalLessons) * 100
      : 0;
  const hasMarkedActivities = activityAvailableMarks > 0;
  const activityAverage = hasMarkedActivities
    ? (activityEarnedMarks / activityAvailableMarks) * 100
    : null;

  return {
    overallMark:
      activityAverage === null
        ? null
        : activityAverage * 0.9 + lessonCompletionPercentage * 0.1,
    activityAverage,
    activityEarnedMarks,
    activityAvailableMarks,
    lessonCompletionPercentage,
    completedLessonCount: safeCompletedLessons,
    totalPublishedLessonCount: safeTotalLessons,
    hasMarkedActivities,
  };
}

export type PerformanceLevel =
  | "Mission Not Started — No marks yet"
  | "Launchpad Learner (0–49%)"
  | "Orbit Builder (50–74%)"
  | "Stellar Achiever (75–100%)";

export function getPerformanceLevel(
  activityAverage: number | null,
): PerformanceLevel {
  if (activityAverage === null) return "Mission Not Started — No marks yet";
  if (activityAverage < 50) return "Launchpad Learner (0–49%)";
  if (activityAverage < 75) return "Orbit Builder (50–74%)";
  return "Stellar Achiever (75–100%)";
}
