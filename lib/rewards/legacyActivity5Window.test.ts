import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_ACTIVITY_5_ID,
  isLegacyActivity5,
  deriveLegacyActivity5Window,
  calculateLegacyActivity5Lateness,
} from "./legacyActivity5Window";
import { calculatePairCoins } from "./coinRules";

test("the legacy rule only matches the exact Activity 5 ID", () => {
  assert.equal(isLegacyActivity5(LEGACY_ACTIVITY_5_ID), true);
  assert.equal(isLegacyActivity5("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(isLegacyActivity5(""), false);
});

test("the first genuine submission establishes the window start", () => {
  const { windowStart } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  assert.equal(windowStart, "2026-08-12T20:43:56.660Z");
});

test("the 24-hour window is calculated correctly", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  assert.equal(windowEnd, "2026-08-13T20:43:56.660Z");
});

test("a pair completed inside the window is on time", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const result = calculateLegacyActivity5Lateness("2026-08-13T20:43:56.660Z", windowEnd);
  assert.equal(result.insideWindow, true);
  assert.equal(result.daysLate, 0);
});

test(
  "activity submitted inside the window but lesson completed later uses the later lesson timestamp",
  () => {
    const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
    const activitySubmittedAt = "2026-08-12T21:00:00.000Z"; // inside the window
    const lessonCompletedAt = "2026-08-15T09:00:00.000Z"; // well after the window
    const pairCompletionTimestamp =
      new Date(activitySubmittedAt).getTime() > new Date(lessonCompletedAt).getTime()
        ? activitySubmittedAt
        : lessonCompletedAt;
    assert.equal(pairCompletionTimestamp, lessonCompletedAt);

    const result = calculateLegacyActivity5Lateness(pairCompletionTimestamp, windowEnd);
    assert.equal(result.insideWindow, false);
    assert.ok(result.daysLate > 0);
  },
);

test("one day late deducts 100 AC", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate } = calculateLegacyActivity5Lateness("2026-08-13T21:00:00.000Z", windowEnd);
  assert.equal(daysLate, 1);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 100);
  assert.equal(coinResult.finalCoins, 900);
});

test("two days late deducts 200 AC", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate } = calculateLegacyActivity5Lateness("2026-08-14T21:00:00.000Z", windowEnd);
  assert.equal(daysLate, 2);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 200);
  assert.equal(coinResult.finalCoins, 800);
});

test("three days late deducts 300 AC", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate } = calculateLegacyActivity5Lateness("2026-08-15T21:00:00.000Z", windowEnd);
  assert.equal(daysLate, 3);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 300);
  assert.equal(coinResult.finalCoins, 700);
});

test("four days late deducts 400 AC", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate } = calculateLegacyActivity5Lateness("2026-08-16T21:00:00.000Z", windowEnd);
  assert.equal(daysLate, 4);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 400);
  assert.equal(coinResult.finalCoins, 600);
});

test("more than four days late awards 0 AC", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate } = calculateLegacyActivity5Lateness("2026-08-17T21:00:01.000Z", windowEnd);
  assert.equal(daysLate, 5);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.qualifies, false);
  assert.equal(coinResult.disqualifiedReason, "more_than_max_days_late");
  assert.equal(coinResult.finalCoins, 0);
});

test("below 50% still awards 0 AC even when on time under the legacy window", () => {
  const { windowEnd } = deriveLegacyActivity5Window("2026-08-12T20:43:56.660Z");
  const { daysLate, insideWindow } = calculateLegacyActivity5Lateness(
    "2026-08-13T00:00:00.000Z",
    windowEnd,
  );
  assert.equal(insideWindow, true);
  const coinResult = calculatePairCoins({ percentage: 40, daysLate });
  assert.equal(coinResult.qualifies, false);
  assert.equal(coinResult.disqualifiedReason, "below_minimum_performance");
  assert.equal(coinResult.finalCoins, 0);
});
