import assert from "node:assert/strict";
import test from "node:test";
import { calculateXpTotal } from "./xpRules";
import {
  XP_MILESTONES,
  deriveXpBreakdown,
  getReachedXpMilestones,
  describeCoinGateProgress,
  getPerformanceTierRows,
  getLatenessRows,
  MAX_LINKED_PAIR_AWARD,
  deriveResultingBalances,
  describeTransactionSource,
} from "./learnerRewardsPresentation";

test("XP breakdown reconciles exactly to canonical totalXp for a range of inputs", () => {
  const cases: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [16, 16],
    [5, 5],
    [100, 37],
  ];
  for (const [lessons, activities] of cases) {
    const breakdown = deriveXpBreakdown(lessons, activities);
    assert.equal(breakdown.lessonXp + breakdown.activityXp, breakdown.totalXp);
    assert.equal(breakdown.totalXp, calculateXpTotal(lessons, activities));
  }
});

test("XP breakdown fields pass through the raw counts unchanged", () => {
  const breakdown = deriveXpBreakdown(16, 16);
  assert.equal(breakdown.lessonsCompleted, 16);
  assert.equal(breakdown.activitiesCompleted, 16);
  assert.equal(breakdown.lessonXp, 3200);
  assert.equal(breakdown.activityXp, 3200);
  assert.equal(breakdown.totalXp, 6400);
});

test("XP milestones are exactly 2,000 / 5,000 / 10,000 -- no 2,500 tier", () => {
  assert.deepEqual(XP_MILESTONES, [2000, 5000, 10000]);
});

test("2,000 XP milestone is reached at exactly 2,000, not before", () => {
  assert.deepEqual(getReachedXpMilestones(1999), []);
  assert.deepEqual(getReachedXpMilestones(2000), [2000]);
});

test("5,000 XP milestone is reached at exactly 5,000, not before", () => {
  assert.deepEqual(getReachedXpMilestones(4999), [2000]);
  assert.deepEqual(getReachedXpMilestones(5000), [2000, 5000]);
});

test("10,000 XP milestone is reached at exactly 10,000, not before", () => {
  assert.deepEqual(getReachedXpMilestones(9999), [2000, 5000]);
  assert.deepEqual(getReachedXpMilestones(10000), [2000, 5000, 10000]);
});

test("a learner below every milestone reaches none", () => {
  assert.deepEqual(getReachedXpMilestones(0), []);
  assert.deepEqual(getReachedXpMilestones(1800), []);
});

test("Coin Gate progress: only XP incomplete names XP specifically", () => {
  const progress = describeCoinGateProgress(1800, 5, 5);
  assert.equal(progress.xp.met, false);
  assert.equal(progress.lessons.met, true);
  assert.equal(progress.activities.met, true);
  assert.equal(progress.message, "Earn 200 more XP to unlock Ad Astra Coins.");
});

test("Coin Gate progress: only lessons incomplete names lessons specifically", () => {
  const progress = describeCoinGateProgress(2000, 4, 5);
  assert.equal(progress.message, "Complete 1 more lesson to unlock Ad Astra Coins.");
});

test("Coin Gate progress: only activities incomplete names activities specifically", () => {
  const progress = describeCoinGateProgress(2000, 5, 4);
  assert.equal(progress.message, "Complete 1 more activity to unlock Ad Astra Coins.");
});

test("Coin Gate progress: multiple requirements incomplete gives a generic message, never inventing one", () => {
  const progress = describeCoinGateProgress(1800, 3, 5);
  assert.equal(progress.message, "Keep completing lessons and activities to unlock Ad Astra Coins.");
});

test("Coin Gate progress: gate fully unlocked has no progress message", () => {
  const progress = describeCoinGateProgress(2000, 5, 5);
  assert.equal(progress.xp.met, true);
  assert.equal(progress.lessons.met, true);
  assert.equal(progress.activities.met, true);
  assert.equal(progress.message, null);
});

test("performance tier table matches the locked reward spec exactly", () => {
  const rows = getPerformanceTierRows();
  assert.deepEqual(
    rows.map((row) => row.totalAward),
    [500, 600, 700, 800, 900, 1000],
  );
});

test("maximum linked-pair award is 1,000 AC", () => {
  assert.equal(MAX_LINKED_PAIR_AWARD, 1000);
});

test("lateness table matches the locked schedule exactly", () => {
  const rows = getLatenessRows();
  assert.deepEqual(
    rows.map((row) => row.deduction),
    ["No deduction", "-100 AC", "-200 AC", "-300 AC", "-400 AC", "0 AC total"],
  );
});

test("resulting balances reconcile: sum of amounts undone equals currentBalance - oldestResultingBalance", () => {
  const transactionsNewestFirst = [
    { amount: 900 }, // most recent
    { amount: -500 },
    { amount: 700 },
  ];
  const currentBalance = 1100;
  const balances = deriveResultingBalances(transactionsNewestFirst, currentBalance);
  assert.deepEqual(balances, [1100, 200, 700]);
  // The balance after the oldest transaction, minus its own amount, is the
  // opening balance (0 here) -- proves the chain is internally consistent.
  assert.equal(balances[balances.length - 1] - transactionsNewestFirst[transactionsNewestFirst.length - 1].amount, 0);
});

test("resulting balances for a single transaction equals the current balance", () => {
  const balances = deriveResultingBalances([{ amount: 500 }], 500);
  assert.deepEqual(balances, [500]);
});

test("resulting balances for an empty ledger is an empty array", () => {
  assert.deepEqual(deriveResultingBalances([], 0), []);
});

test("transaction source prefers the ledger's own reason text", () => {
  assert.equal(
    describeTransactionSource("Activity 7 - Lesson 3.7", "lesson_activity_reward"),
    "Activity 7 - Lesson 3.7",
  );
});

test("transaction source falls back to a friendly label per type when reason is null or blank", () => {
  assert.equal(describeTransactionSource(null, "lesson_activity_reward"), "Lesson & activity reward");
  assert.equal(describeTransactionSource("   ", "store_redemption"), "Store redemption");
  assert.equal(describeTransactionSource(null, "admin_adjustment"), "Ad Astra Coin adjustment");
});

test("transaction source never leaks a raw unrecognised enum value", () => {
  assert.equal(describeTransactionSource(null, "some_future_type"), "Ad Astra Coin transaction");
});
