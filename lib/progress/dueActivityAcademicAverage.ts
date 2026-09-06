// AD ASTRA ACADEMIC AVERAGE MODEL CORRECTION.
//
// Shared, subject-agnostic equal-weight academic average used by BOTH the
// learner subject dashboard/card (lib/supabase/businessStudiesLearnerOverview.ts,
// scoped to every currently-due graded activity in the subject) and the
// Monthly Report engine (lib/reports/monthlyReportCalculations.ts, scoped
// to the teacher's explicit selection). The two contexts differ only in
// WHICH activities are fed in -- this function's classification rule is
// identical either way, so it lives here once rather than as four
// subject-specific or two feature-specific re-implementations.
//
// Deliberately NOT weighted by raw available marks (a 26-mark activity
// and a 10-mark activity count equally): every classified activity is one
// equal slot. Kingdom's preliminary mark is never an input here -- only
// the caller-resolved authoritative teacher-final percentage.
//
// Classification per activity:
//   - hasAuthoritativeMark (status === "returned" AND a valid final_mark)
//     -> ALWAYS included, contributing its real percentage. Genuine
//     evidence is never excluded merely because of due-date timing.
//   - submitted but not yet returned (submitted / marking_failed /
//     awaiting_review) -> ALWAYS excluded from the denominator. This is a
//     deliberate generalisation of the "awaiting review" safeguard: ANY
//     submitted-but-not-teacher-finalised state must not be penalised for
//     a teacher-side delay, not literally only the "awaiting_review"
//     status value.
//   - not submitted AND overdue (isOverdue) -> included, contributing 0%.
//     Missing due work is part of current academic progress by design.
//   - not submitted AND not yet overdue (genuinely not yet due) -> ALWAYS
//     excluded. A learner is never penalised for work that was not yet
//     expected.

import type { LearnerActivitySubmissionStatus } from "@/lib/activities/learnerActivityStatus";

export type DueActivityAcademicItem = {
  hasAuthoritativeMark: boolean;
  percentage: number | null;
  submissionStatus: "not_submitted" | LearnerActivitySubmissionStatus;
  // Meaningful only when submissionStatus === "not_submitted" (mirrors
  // MonthlyReportActivityEntry.isOverdue's own contract) -- ignored
  // entirely for any submitted-family status.
  isOverdue: boolean;
};

export type DueActivityAcademicResult = {
  // Equal-weight arithmetic mean over the effective slots below. Null
  // when there are zero effective slots (never 0%, which would wrongly
  // imply a real zero-evidence result).
  average: number | null;
  // The denominator: returnedActivityCount + overdueMissingActivityCount.
  effectiveActivityCount: number;
  returnedActivityCount: number;
  overdueMissingActivityCount: number;
  awaitingReviewActivityCount: number;
  notYetDueActivityCount: number;
};

export function calculateDueActivityAcademicAverage(
  items: readonly DueActivityAcademicItem[],
): DueActivityAcademicResult {
  let returnedActivityCount = 0;
  let overdueMissingActivityCount = 0;
  let awaitingReviewActivityCount = 0;
  let notYetDueActivityCount = 0;
  let sum = 0;

  for (const item of items) {
    if (item.hasAuthoritativeMark && item.percentage !== null) {
      returnedActivityCount += 1;
      sum += item.percentage;
      continue;
    }

    if (item.submissionStatus === "not_submitted") {
      if (item.isOverdue) {
        overdueMissingActivityCount += 1;
        sum += 0;
      } else {
        notYetDueActivityCount += 1;
      }
      continue;
    }

    // submitted / marking_failed / awaiting_review -- provisional, never
    // penalised for a teacher-side delay.
    awaitingReviewActivityCount += 1;
  }

  const effectiveActivityCount = returnedActivityCount + overdueMissingActivityCount;

  return {
    average: effectiveActivityCount > 0 ? sum / effectiveActivityCount : null,
    effectiveActivityCount,
    returnedActivityCount,
    overdueMissingActivityCount,
    awaitingReviewActivityCount,
    notYetDueActivityCount,
  };
}
