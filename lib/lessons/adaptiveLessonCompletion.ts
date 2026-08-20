// Canonical, pure predicate for AD Astra's adaptive lesson-completion rule:
// a lesson is complete when every material type that ACTUALLY EXISTS for it
// has been completed according to its own rule. A material type that
// doesn't exist for a lesson is never required. This is the single source
// of truth the learner lesson page, the completion-persisting server
// helper (lib/lessons/lessonCompletionService.ts), and the teacher learning
// tracker all derive from -- none of them should reimplement this
// predicate independently.
export const VIDEO_COMPLETION_THRESHOLD_PERCENT = 90;

export type LessonMaterialAvailability = {
  hasReading: boolean;
  hasVideo: boolean;
  hasQuiz: boolean;
};

export type LessonMaterialCompletionSignals = {
  isReadingComplete: boolean;
  isVideoComplete: boolean;
  isQuizPassed: boolean;
};

export type LessonRequiredMaterialType = "reading" | "video" | "quiz";

export type AdaptiveLessonCompletionResult = {
  requiredTypes: LessonRequiredMaterialType[];
  satisfiedTypes: LessonRequiredMaterialType[];
  isComplete: boolean;
};

export function evaluateAdaptiveLessonCompletion(
  availability: LessonMaterialAvailability,
  signals: LessonMaterialCompletionSignals,
): AdaptiveLessonCompletionResult {
  const requiredTypes: LessonRequiredMaterialType[] = [];
  const satisfiedTypes: LessonRequiredMaterialType[] = [];

  if (availability.hasReading) {
    requiredTypes.push("reading");
    if (signals.isReadingComplete) satisfiedTypes.push("reading");
  }

  if (availability.hasVideo) {
    requiredTypes.push("video");
    if (signals.isVideoComplete) satisfiedTypes.push("video");
  }

  if (availability.hasQuiz) {
    requiredTypes.push("quiz");
    if (signals.isQuizPassed) satisfiedTypes.push("quiz");
  }

  return {
    requiredTypes,
    satisfiedTypes,
    // A lesson with zero materials is never auto-completable -- there is
    // nothing to have satisfied, so treating it as "complete" would be
    // meaningless (and could mask a genuinely broken/empty lesson).
    isComplete:
      requiredTypes.length > 0 && satisfiedTypes.length === requiredTypes.length,
  };
}

export function isVideoProgressComplete(progressPercent: number): boolean {
  return progressPercent >= VIDEO_COMPLETION_THRESHOLD_PERCENT;
}

// A lesson is "late" only when it IS complete but was completed after its
// expected completion date -- this must never be conflated with "Needs
// Attention"/"Overdue", which applies only to lessons that are still
// incomplete past their due date. Date comparison mirrors the existing
// activity submission-timing convention (lib/activities/submissionTiming.ts):
// plain YYYY-MM-DD key comparison, no timezone conversion needed since both
// values are already ISO date(time) strings.
export function isLessonCompletionLate(
  completedAt: string,
  expectedCompletionDate: string | null,
): boolean {
  if (!expectedCompletionDate) return false;
  return completedAt.slice(0, 10) > expectedCompletionDate.slice(0, 10);
}
