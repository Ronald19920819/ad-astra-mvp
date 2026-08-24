import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_ACTIVITY_2_ID,
  isLegacyActivity2,
  deriveLegacyActivity2Window,
  calculateLegacyActivity2Lateness,
} from "./legacyActivity2Window";
import { LEGACY_ACTIVITY_5_ID, isLegacyActivity5 } from "./legacyActivity5Window";
import { calculatePairCoins } from "./coinRules";

test("the legacy rule only matches the exact approved BS IG1 Activity 2 ID", () => {
  assert.equal(isLegacyActivity2(LEGACY_ACTIVITY_2_ID), true);
  assert.equal(isLegacyActivity2("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(isLegacyActivity2(""), false);
});

test("the first genuine submission establishes the window start", () => {
  const { windowStart } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  assert.equal(windowStart, "2026-08-12T18:21:12.485Z");
});

test("the 24-hour window is calculated correctly", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  assert.equal(windowEnd, "2026-08-13T18:21:12.485Z");
});

test("pair completion uses the later of lesson completion / activity submission, and inside the window is on time", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const activitySubmittedAt = "2026-08-12T18:21:12.485Z";
  const lessonCompletedAt = "2026-08-12T18:14:29.025Z"; // earlier than submission
  const pairCompletionTimestamp =
    new Date(activitySubmittedAt).getTime() > new Date(lessonCompletedAt).getTime()
      ? activitySubmittedAt
      : lessonCompletedAt;
  assert.equal(pairCompletionTimestamp, activitySubmittedAt);

  const result = calculateLegacyActivity2Lateness(pairCompletionTimestamp, windowEnd);
  assert.equal(result.insideWindow, true);
  assert.equal(result.daysLate, 0);
});

test("one day late deducts 100 AC", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate } = calculateLegacyActivity2Lateness("2026-08-13T19:00:00.000Z", windowEnd);
  assert.equal(daysLate, 1);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 100);
  assert.equal(coinResult.finalCoins, 900);
});

test("two days late deducts 200 AC", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate } = calculateLegacyActivity2Lateness("2026-08-14T19:00:00.000Z", windowEnd);
  assert.equal(daysLate, 2);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 200);
  assert.equal(coinResult.finalCoins, 800);
});

test("three days late deducts 300 AC", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate } = calculateLegacyActivity2Lateness("2026-08-15T19:00:00.000Z", windowEnd);
  assert.equal(daysLate, 3);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 300);
  assert.equal(coinResult.finalCoins, 700);
});

test("four days late deducts 400 AC", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate } = calculateLegacyActivity2Lateness("2026-08-16T19:00:00.000Z", windowEnd);
  assert.equal(daysLate, 4);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.lateDeduction, 400);
  assert.equal(coinResult.finalCoins, 600);
});

test("more than four days late awards 0 AC", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate } = calculateLegacyActivity2Lateness("2026-08-17T19:00:01.000Z", windowEnd);
  assert.equal(daysLate, 5);
  const coinResult = calculatePairCoins({ percentage: 100, daysLate });
  assert.equal(coinResult.qualifies, false);
  assert.equal(coinResult.disqualifiedReason, "more_than_max_days_late");
  assert.equal(coinResult.finalCoins, 0);
});

test("below 50% still awards 0 AC even when on time under this legacy window", () => {
  const { windowEnd } = deriveLegacyActivity2Window("2026-08-12T18:21:12.485Z");
  const { daysLate, insideWindow } = calculateLegacyActivity2Lateness(
    "2026-08-13T00:00:00.000Z",
    windowEnd,
  );
  assert.equal(insideWindow, true);
  const coinResult = calculatePairCoins({ percentage: 40, daysLate });
  assert.equal(coinResult.qualifies, false);
  assert.equal(coinResult.disqualifiedReason, "below_minimum_performance");
  assert.equal(coinResult.finalCoins, 0);
});

test("BS IG2 Activity 5's exception is untouched and independent of this one", () => {
  assert.equal(isLegacyActivity5(LEGACY_ACTIVITY_5_ID), true);
  assert.equal(isLegacyActivity5(LEGACY_ACTIVITY_2_ID), false);
  assert.equal(isLegacyActivity2(LEGACY_ACTIVITY_5_ID), false);
});

test("an ordinary missing-due-date activity does not receive either legacy treatment", () => {
  const someOtherActivityWithNoDueDate = "99999999-9999-4999-8999-999999999999";
  assert.equal(isLegacyActivity2(someOtherActivityWithNoDueDate), false);
  assert.equal(isLegacyActivity5(someOtherActivityWithNoDueDate), false);
});

test("no normal activity can enter either exception accidentally", () => {
  const normalActivityIds = [
    "630092c6-bba6-4f5d-bdc7-721b2f20d53d", // Activity 1 - Lesson 3.1, BS IGCSE2
    "e281c30d-c4a2-43d3-b64b-40aa4c6f7a80", // Activity 0 - Lesson 0.0, BS IGCSE2
  ];
  for (const activityId of normalActivityIds) {
    assert.equal(isLegacyActivity2(activityId), false);
    assert.equal(isLegacyActivity5(activityId), false);
  }
});
