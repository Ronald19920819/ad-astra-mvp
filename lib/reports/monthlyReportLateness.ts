import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import {
  isLegacyActivity5,
  calculateLegacyActivity5Lateness,
} from "@/lib/rewards/legacyActivity5Window";
import {
  isLegacyActivity2,
  calculateLegacyActivity2Lateness,
} from "@/lib/rewards/legacyActivity2Window";
import type { DueDateBasis } from "@/lib/reports/monthlyReportTypes";

// Pure activity-lateness resolver for the Monthly Report. Mirrors the
// EXACT day-boundary semantics already established in
// lib/supabase/coinEarningEngine.ts (dateKey/daysBetweenDateKeys are not
// exported there, so the two-line date-key arithmetic is reproduced here
// rather than modifying that file, which is out of scope for this stage)
// and reuses the two approved historical exceptions' own exported
// functions verbatim -- never re-deriving their constants or arithmetic.

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetweenDateKeys(laterKey: string, earlierKey: string): number {
  const later = new Date(`${laterKey}T00:00:00Z`).getTime();
  const earlier = new Date(`${earlierKey}T00:00:00Z`).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

export type ResolvedActivityTiming = {
  dueDate: string | null;
  dueDateBasis: DueDateBasis;
  isLate: boolean | null;
  daysLate: number | null;
  isOverdue: boolean;
};

export function resolveActivityTiming({
  activityId,
  isSubmitted,
  submittedAt,
  liveDueDate,
  snapshotDueDate,
  legacyActivity5WindowEnd,
  legacyActivity2WindowEnd,
  now = new Date(),
}: {
  activityId: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  liveDueDate: string | null;
  snapshotDueDate: string | null;
  legacyActivity5WindowEnd: string | null;
  legacyActivity2WindowEnd: string | null;
  now?: Date;
}): ResolvedActivityTiming {
  if (isLegacyActivity5(activityId)) {
    return resolveLegacyTiming({
      dueDateBasis: "legacy_24h_window_activity_5",
      windowEnd: legacyActivity5WindowEnd,
      isSubmitted,
      submittedAt,
      calculateLateness: calculateLegacyActivity5Lateness,
      now,
    });
  }

  if (isLegacyActivity2(activityId)) {
    return resolveLegacyTiming({
      dueDateBasis: "legacy_24h_window_activity_2",
      windowEnd: legacyActivity2WindowEnd,
      isSubmitted,
      submittedAt,
      calculateLateness: calculateLegacyActivity2Lateness,
      now,
    });
  }

  // Frozen submission snapshot's due date takes precedence over the
  // (possibly later-edited) live activity due date -- the same principle
  // already locked in for the mark denominator (original_total_marks) and
  // reused verbatim by the Coin engine for this exact field.
  const dueDate = snapshotDueDate ?? liveDueDate;

  if (isSubmitted && submittedAt) {
    if (!dueDate) {
      // A normal (non-legacy) activity with genuinely no due date at all.
      // No fabricated date, no guessed lateness -- timing is simply
      // indeterminate, exactly like an unanchored legacy window.
      return { dueDate: null, dueDateBasis: "normal", isLate: null, daysLate: null, isOverdue: false };
    }

    const daysLate = Math.max(
      0,
      daysBetweenDateKeys(dateKey(submittedAt), dateKey(dueDate)),
    );
    return {
      dueDate,
      dueDateBasis: "normal",
      isLate: daysLate > 0,
      daysLate,
      isOverdue: false,
    };
  }

  return {
    dueDate,
    dueDateBasis: "normal",
    isLate: null,
    daysLate: null,
    isOverdue: isDateOverdue(dueDate, now),
  };
}

function resolveLegacyTiming({
  dueDateBasis,
  windowEnd,
  isSubmitted,
  submittedAt,
  calculateLateness,
  now,
}: {
  dueDateBasis: DueDateBasis;
  windowEnd: string | null;
  isSubmitted: boolean;
  submittedAt: string | null;
  calculateLateness: (
    pairCompletionTimestamp: string,
    legacyWindowEnd: string,
  ) => { insideWindow: boolean; daysLate: number };
  now: Date;
}): ResolvedActivityTiming {
  // The window itself is anchored to the FIRST GENUINE submission of this
  // activity platform-wide (see legacyActivity5Window.ts /
  // legacyActivity2Window.ts). If nobody has ever genuinely submitted to
  // it yet, there is no window to compare against -- timing is
  // indeterminate, never fabricated.
  if (!windowEnd) {
    return { dueDate: null, dueDateBasis, isLate: null, daysLate: null, isOverdue: false };
  }

  if (isSubmitted && submittedAt) {
    const lateness = calculateLateness(submittedAt, windowEnd);
    return {
      dueDate: null,
      dueDateBasis,
      isLate: !lateness.insideWindow,
      daysLate: lateness.daysLate,
      isOverdue: false,
    };
  }

  return {
    dueDate: null,
    dueDateBasis,
    isLate: null,
    daysLate: null,
    isOverdue: now.getTime() > new Date(windowEnd).getTime(),
  };
}
