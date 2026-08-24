// ONE approved historical exception (Stage 5, locked): the teacher never set
// a due date for this single activity when it was created (see the Stage
// 4.5 due-date investigation). Learners must not lose AC over a teacher-side
// omission, but we must also never invent or write a historical due date --
// activities.due_date, lessons.expected_completion_date, and every frozen
// activity_snapshot stay untouched forever for this activity. Instead,
// historical AC backfill for this activity ALONE substitutes a derived
// 24-hour completion window anchored to the first genuine learner
// submission. This module is the one definition of that derivation, shared
// by the read-only preview (lib/supabase/coinEarningEngine.ts) and whatever
// authorised backfill write path eventually consumes its output.
export const LEGACY_ACTIVITY_5_ID = "4fd63382-1612-4685-9955-cf4271c62314";
export const LEGACY_LESSON_3_5_ID = "13415309-3be6-48ec-a71f-2e2eb0e72b38";
export const LEGACY_BUSINESS_STUDIES_IGCSE2_SUBJECT_ID =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";

const MS_PER_DAY = 86_400_000;

export function isLegacyActivity5(activityId: string): boolean {
  return activityId === LEGACY_ACTIVITY_5_ID;
}

export type LegacyActivity5Window = {
  windowStart: string;
  windowEnd: string;
};

// windowStart is the first genuine submission's own timestamp; windowEnd is
// exactly 24 hours later. A learner who completes the pair (lesson +
// activity, whichever is later) at or before windowEnd is on time.
export function deriveLegacyActivity5Window(
  firstGenuineSubmissionAt: string,
): LegacyActivity5Window {
  const windowStart = firstGenuineSubmissionAt;
  const windowEnd = new Date(
    new Date(firstGenuineSubmissionAt).getTime() + MS_PER_DAY,
  ).toISOString();
  return { windowStart, windowEnd };
}

export type LegacyActivity5LatenessResult = {
  insideWindow: boolean;
  daysLate: number;
};

// Mirrors the normal engine's day-boundary semantics (lib/supabase/
// coinEarningEngine.ts's dateKey/daysBetweenDateKeys): there, any overrun
// into a new calendar date -- even by one minute past midnight -- counts as
// a full day late. There is no calendar date to anchor this rolling 24-hour
// window to, so the direct translation is the same "round any overrun up to
// a full period" rule applied to 24-hour periods instead of calendar days.
export function calculateLegacyActivity5Lateness(
  pairCompletionTimestamp: string,
  legacyWindowEnd: string,
): LegacyActivity5LatenessResult {
  const pairMs = new Date(pairCompletionTimestamp).getTime();
  const windowEndMs = new Date(legacyWindowEnd).getTime();

  if (pairMs <= windowEndMs) {
    return { insideWindow: true, daysLate: 0 };
  }

  return {
    insideWindow: false,
    daysLate: Math.ceil((pairMs - windowEndMs) / MS_PER_DAY),
  };
}
