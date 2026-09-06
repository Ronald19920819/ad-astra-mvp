import type {
  MonthlyReportBadge,
  MonthlyReportBadgeKey,
} from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY REPORT -- BADGE & KINGDOM COMMENTARY RECALIBRATION.
//
// Pure, deterministic Monthly Achievement badge calculation. LOCKED report
// evidence hierarchy: Academic Performance (primary) and Completion/
// Engagement (secondary) decide the badge; Punctuality is supporting/
// diagnostic only -- it remains calculated and reported (see
// punctualityThresholdPassed below, and the report's own On-Time Work
// figure), but it is NOT a badge eligibility gate. A learner who completes
// all selected work to a high academic standard must not be demoted to
// Course Correction merely because much of that work was late -- and a
// learner who completes very little work is already penalised through low
// combinedCompletionRate and insufficient reviewed evidence, without a
// second, redundant punctuality penalty on top.
//
// combinedCompletionRate/combinedPunctualityRate are still the "combined"
// (lesson+activity averaged, via calculateEngagementSummary's own
// averageOfExisting) figures -- this module never recomputes them.

const STELLAR_ACADEMIC_THRESHOLD = 80;
const STELLAR_COMPLETION_THRESHOLD = 0.8;

const ON_COURSE_ACADEMIC_THRESHOLD = 60;
const ON_COURSE_COMPLETION_THRESHOLD = 0.6;

// Punctuality is reported informationally (punctualityThresholdPassed)
// against the same bar the On Course completion/academic gates use, purely
// so the fact is still visible on the badge record -- it plays no part in
// `meetsStellar`/`meetsOnCourse`/`key` below.
const PUNCTUALITY_INFORMATIONAL_THRESHOLD = 0.6;

export type MonthlyReportBadgeInput = {
  academicPercentage: number | null;
  combinedCompletionRate: number | null;
  combinedPunctualityRate: number | null;
  // Whether there is enough authoritative academic evidence to award a
  // positive badge at all (see calculateEvidenceFlags's
  // insufficientMarkedEvidence: returnedActivityCount < 4). A learner with
  // a 95% average from only 2 marked activities must never receive Stellar
  // or On Course purely from a tiny sample -- V1 deliberately has no
  // separate "insufficient evidence" badge, so this always falls back to
  // Course Correction rather than inventing a fourth state.
  sufficientEvidence: boolean;
};

export function calculateMonthlyReportBadge(
  input: MonthlyReportBadgeInput,
): MonthlyReportBadge {
  const {
    academicPercentage,
    combinedCompletionRate,
    combinedPunctualityRate,
    sufficientEvidence,
  } = input;

  const meetsStellar =
    sufficientEvidence &&
    academicPercentage !== null &&
    academicPercentage >= STELLAR_ACADEMIC_THRESHOLD &&
    combinedCompletionRate !== null &&
    combinedCompletionRate >= STELLAR_COMPLETION_THRESHOLD;

  const meetsOnCourse =
    sufficientEvidence &&
    academicPercentage !== null &&
    academicPercentage >= ON_COURSE_ACADEMIC_THRESHOLD &&
    combinedCompletionRate !== null &&
    combinedCompletionRate >= ON_COURSE_COMPLETION_THRESHOLD;

  const key: MonthlyReportBadgeKey = meetsStellar
    ? "stellar"
    : meetsOnCourse
      ? "on_course"
      : "course_correction";

  // Reported against the lower (On Course) bar regardless of the final
  // badge, so a Course Correction result is explainable: which of the two
  // GATING factors actually fell short, independent of evidence
  // sufficiency (reported separately below). punctualityThresholdPassed is
  // informational only, as above.
  return {
    key,
    academicThresholdPassed:
      academicPercentage !== null &&
      academicPercentage >= ON_COURSE_ACADEMIC_THRESHOLD,
    completionThresholdPassed:
      combinedCompletionRate !== null &&
      combinedCompletionRate >= ON_COURSE_COMPLETION_THRESHOLD,
    punctualityThresholdPassed:
      combinedPunctualityRate !== null &&
      combinedPunctualityRate >= PUNCTUALITY_INFORMATIONAL_THRESHOLD,
    sufficientEvidence,
  };
}
