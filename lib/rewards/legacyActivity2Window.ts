// The SECOND (and, as of Stage 5B, final) approved historical exception.
// Stage 5A proved this activity has the exact same root cause as the
// approved Lesson 3.5 / Activity 5 exception (lib/rewards/
// legacyActivity5Window.ts, deliberately NOT modified by this file): the
// teacher never set a due date when the activity was created, confirmed by
// every one of its frozen, live-captured submission snapshots showing
// dueDate: null from the day after creation onward. Learners must not lose
// AC over that teacher-side omission, but a historical due date must never
// be invented or written back -- activities.due_date, lessons.expected_
// completion_date, and every frozen activity_snapshot stay untouched
// forever for this activity too.
//
// This is a SEPARATE, independently identifiable module rather than a
// generalised "any missing-due-date activity" mechanism -- there are
// exactly two approved historical exceptions, each allowlisted to its own
// hardcoded activity ID. No third activity can enter this treatment; a
// generic platform-wide fallback was explicitly rejected for Stage 5B.
export const LEGACY_ACTIVITY_2_ID = "a50b5cf4-7c10-4625-8ab2-28478760b992";
export const LEGACY_LESSON_3_2_ID = "bebd2323-5317-4873-b279-29cb4ade7e54";
export const LEGACY_BUSINESS_STUDIES_IGCSE1_SUBJECT_ID =
  "7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11";

const MS_PER_DAY = 86_400_000;

export function isLegacyActivity2(activityId: string): boolean {
  return activityId === LEGACY_ACTIVITY_2_ID;
}

export type LegacyActivity2Window = {
  windowStart: string;
  windowEnd: string;
};

// windowStart is the first genuine submission's own timestamp; windowEnd is
// exactly 24 hours later. A learner who completes the pair (lesson +
// activity, whichever is later) at or before windowEnd is on time.
export function deriveLegacyActivity2Window(
  firstGenuineSubmissionAt: string,
): LegacyActivity2Window {
  const windowStart = firstGenuineSubmissionAt;
  const windowEnd = new Date(
    new Date(firstGenuineSubmissionAt).getTime() + MS_PER_DAY,
  ).toISOString();
  return { windowStart, windowEnd };
}

export type LegacyActivity2LatenessResult = {
  insideWindow: boolean;
  daysLate: number;
};

// Mirrors the normal engine's day-boundary semantics and the identical
// derivation used for the approved Activity 5 exception: any overrun past
// the window end -- even by a minute -- rounds up to a full day late,
// matching how a calendar-date due date already treats crossing into a new
// day as a full day late.
export function calculateLegacyActivity2Lateness(
  pairCompletionTimestamp: string,
  legacyWindowEnd: string,
): LegacyActivity2LatenessResult {
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
