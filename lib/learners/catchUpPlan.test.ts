import assert from "node:assert/strict";
import test from "node:test";
import {
  CATCH_UP_DAILY_MINUTES,
  CATCH_UP_MINUTES_PER_LESSON,
  CATCH_UP_MINUTES_PER_MARK,
  calculateCatchUpPlan,
  formatCatchUpDuration,
} from "./catchUpPlan";

const FIXED_TODAY = new Date("2026-08-20T09:00:00+02:00");

test("fixed rules match the locked spec: 15 min/lesson, 1 min/mark, 60 min/day", () => {
  assert.equal(CATCH_UP_MINUTES_PER_LESSON, 15);
  assert.equal(CATCH_UP_MINUTES_PER_MARK, 1);
  assert.equal(CATCH_UP_DAILY_MINUTES, 60);
});

// G. 2 incomplete lessons + 20-mark activity -> 30 + 20 = 50 minutes -> caught up today
test("G: 2 lessons + one 20-mark activity totals 50 minutes and is caught up today", () => {
  const plan = calculateCatchUpPlan(
    { outstandingLessonCount: 2, outstandingActivityMarks: [20] },
    FIXED_TODAY,
  );
  assert.equal(plan.lessonMinutes, 30);
  assert.equal(plan.activityMinutes, 20);
  assert.equal(plan.totalMinutes, 50);
  assert.equal(plan.daysRequired, 1);
  assert.equal(plan.catchUpByDateKey, "2026-08-20");
});

// H. 3 lessons + 20-mark + 30-mark activities -> 45 + 20 + 30 = 95 minutes -> 2 catch-up days
test("H: 3 lessons + 20-mark + 30-mark activities totals 95 minutes over 2 days, done tomorrow", () => {
  const plan = calculateCatchUpPlan(
    { outstandingLessonCount: 3, outstandingActivityMarks: [20, 30] },
    FIXED_TODAY,
  );
  assert.equal(plan.lessonMinutes, 45);
  assert.equal(plan.activityMinutes, 50);
  assert.equal(plan.totalMinutes, 95);
  assert.equal(plan.daysRequired, 2);
  assert.equal(plan.catchUpByDateKey, "2026-08-21");
});

// J. no outstanding work -> all caught up
test("J: no outstanding lessons or activities means 0 minutes, 0 days, no fake date", () => {
  const plan = calculateCatchUpPlan(
    { outstandingLessonCount: 0, outstandingActivityMarks: [] },
    FIXED_TODAY,
  );
  assert.equal(plan.outstandingLessonCount, 0);
  assert.equal(plan.outstandingActivityCount, 0);
  assert.equal(plan.totalMinutes, 0);
  assert.equal(plan.daysRequired, 0);
  assert.equal(plan.catchUpByDateKey, null);
});

test("exactly 60 minutes is still caught up today (one full daily block)", () => {
  const plan = calculateCatchUpPlan(
    { outstandingLessonCount: 4, outstandingActivityMarks: [] },
    FIXED_TODAY,
  );
  assert.equal(plan.totalMinutes, 60);
  assert.equal(plan.daysRequired, 1);
  assert.equal(plan.catchUpByDateKey, "2026-08-20");
});

test("61 minutes spills into a second day, not caught up today", () => {
  const plan = calculateCatchUpPlan(
    { outstandingLessonCount: 4, outstandingActivityMarks: [1] },
    FIXED_TODAY,
  );
  assert.equal(plan.totalMinutes, 61);
  assert.equal(plan.daysRequired, 2);
  assert.equal(plan.catchUpByDateKey, "2026-08-21");
});

// I. completing one item reduces the live-calculated total (no stored total
// to go stale -- calling the pure function again with fewer outstanding
// items is the whole mechanism).
test("I: completing an outstanding activity reduces the recalculated total", () => {
  const before = calculateCatchUpPlan(
    { outstandingLessonCount: 1, outstandingActivityMarks: [20, 30] },
    FIXED_TODAY,
  );
  const afterCompletingThe30MarkActivity = calculateCatchUpPlan(
    { outstandingLessonCount: 1, outstandingActivityMarks: [20] },
    FIXED_TODAY,
  );
  assert.equal(before.totalMinutes, 65);
  assert.equal(afterCompletingThe30MarkActivity.totalMinutes, 35);
  assert.ok(afterCompletingThe30MarkActivity.totalMinutes < before.totalMinutes);
});

test("formatCatchUpDuration renders hours and minutes readably", () => {
  assert.equal(formatCatchUpDuration(0), "0 minutes");
  assert.equal(formatCatchUpDuration(45), "45 min");
  assert.equal(formatCatchUpDuration(60), "1 hr");
  assert.equal(formatCatchUpDuration(95), "1 hr 35 min");
  assert.equal(formatCatchUpDuration(120), "2 hr");
});
