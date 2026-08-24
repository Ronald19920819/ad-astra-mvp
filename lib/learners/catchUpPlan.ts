import { addDaysToDateKey, dateKeyInTimeZone } from "@/lib/dates/deadlineStatus";

// Fixed catch-up rules (locked product decision): every outstanding lesson
// costs a flat 15 minutes; every outstanding activity costs 1 minute per
// mark it's worth; a learner is expected to commit 60 minutes/day.
export const CATCH_UP_MINUTES_PER_LESSON = 15;
export const CATCH_UP_MINUTES_PER_MARK = 1;
export const CATCH_UP_DAILY_MINUTES = 60;

export type CatchUpPlanInput = {
  outstandingLessonCount: number;
  outstandingActivityMarks: readonly number[];
};

export type CatchUpPlan = {
  outstandingLessonCount: number;
  outstandingActivityCount: number;
  lessonMinutes: number;
  activityMinutes: number;
  totalMinutes: number;
  daysRequired: number;
  // "YYYY-MM-DD", or null when there's nothing outstanding.
  catchUpByDateKey: string | null;
};

// Computed live from the learner's actual outstanding lessons/activities on
// every load -- never a stored total, so it shrinks automatically the next
// time this is calculated after the learner completes something.
export function calculateCatchUpPlan(
  input: CatchUpPlanInput,
  now = new Date(),
): CatchUpPlan {
  const lessonMinutes =
    input.outstandingLessonCount * CATCH_UP_MINUTES_PER_LESSON;
  const activityMinutes = input.outstandingActivityMarks.reduce(
    (sum, marks) => sum + marks * CATCH_UP_MINUTES_PER_MARK,
    0,
  );
  const totalMinutes = lessonMinutes + activityMinutes;

  // Math.ceil(0 / 60) is 0 already, so this needs no special case -- but
  // spelled out explicitly per spec ("For 0 outstanding minutes:
  // daysRequired = 0") rather than relying on that being implicit.
  const daysRequired =
    totalMinutes === 0 ? 0 : Math.ceil(totalMinutes / CATCH_UP_DAILY_MINUTES);

  // Day 1 is today: a learner who commits their first 60-minute block today
  // uses it up on day 1, so `daysRequired` total days means the LAST day is
  // (daysRequired - 1) days from today. This is what keeps <=60 minutes
  // ("caught up today") and the 95-minute/2-day example ("caught up
  // tomorrow") both falling out of one formula with no separate branch.
  const catchUpByDateKey =
    daysRequired > 0
      ? addDaysToDateKey(dateKeyInTimeZone(now), daysRequired - 1)
      : null;

  return {
    outstandingLessonCount: input.outstandingLessonCount,
    outstandingActivityCount: input.outstandingActivityMarks.length,
    lessonMinutes,
    activityMinutes,
    totalMinutes,
    daysRequired,
    catchUpByDateKey,
  };
}

export function formatCatchUpDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 minutes";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
