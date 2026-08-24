import assert from "node:assert/strict";
import test from "node:test";
import {
  COIN_BASE_AWARD,
  COIN_MAX_LATE_DAYS_BEFORE_ZERO,
  COIN_MIN_PERFORMANCE_PERCENTAGE,
  COIN_TO_RAND_NOMINAL_RATE,
  calculatePairCoins,
  coinsToNominalRand,
  performanceBonus,
} from "./coinRules";

test("locked constants match the spec exactly", () => {
  assert.equal(COIN_MIN_PERFORMANCE_PERCENTAGE, 50);
  assert.equal(COIN_BASE_AWARD, 500);
  assert.equal(COIN_MAX_LATE_DAYS_BEFORE_ZERO, 4);
  assert.equal(COIN_TO_RAND_NOMINAL_RATE, 100);
});

test("100 Coins = R1 nominal value", () => {
  assert.equal(coinsToNominalRand(500), 5);
  assert.equal(coinsToNominalRand(1000), 10);
});

// <50% = 0
test("below 50% never qualifies for Coins", () => {
  const result = calculatePairCoins({ percentage: 49.9, daysLate: 0 });
  assert.equal(result.qualifies, false);
  assert.equal(result.disqualifiedReason, "below_minimum_performance");
  assert.equal(result.finalCoins, 0);
});

// 50-59 = 500, 60-69 = 600, 70-79 = 700, 80-89 = 800, 90-99 = 900, 100 = 1000
test("performance tiers match the spec exactly (on time, no deduction)", () => {
  const cases: Array<[number, number]> = [
    [50, 500],
    [59, 500],
    [60, 600],
    [69, 600],
    [70, 700],
    [79, 700],
    [80, 800],
    [89, 800],
    [90, 900],
    [99, 900],
    [100, 1000],
  ];
  for (const [percentage, expectedCoins] of cases) {
    const result = calculatePairCoins({ percentage, daysLate: 0 });
    assert.equal(result.finalCoins, expectedCoins, `${percentage}% should yield ${expectedCoins}`);
    assert.equal(result.qualifies, true);
  }
});

test("performanceBonus alone matches the spec tiers", () => {
  assert.equal(performanceBonus(55), 0);
  assert.equal(performanceBonus(65), 100);
  assert.equal(performanceBonus(75), 200);
  assert.equal(performanceBonus(85), 300);
  assert.equal(performanceBonus(95), 400);
  assert.equal(performanceBonus(100), 500);
});

// Maximum before lateness: 1,000
test("100% on time is the maximum possible award before lateness", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 0 });
  assert.equal(result.finalCoins, 1000);
});

// 1/2/3/4 day late deductions
test("1 day late deducts 100", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 1 });
  assert.equal(result.lateDeduction, 100);
  assert.equal(result.finalCoins, 900);
});

test("2 days late deducts 200", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 2 });
  assert.equal(result.lateDeduction, 200);
  assert.equal(result.finalCoins, 800);
});

test("3 days late deducts 300", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 3 });
  assert.equal(result.lateDeduction, 300);
  assert.equal(result.finalCoins, 700);
});

test("4 days late deducts 400", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 4 });
  assert.equal(result.lateDeduction, 400);
  assert.equal(result.finalCoins, 600);
});

// >4 days late = 0 total
test("more than 4 days late is 0 Coins total, not merely a bigger deduction", () => {
  const result = calculatePairCoins({ percentage: 100, daysLate: 5 });
  assert.equal(result.qualifies, false);
  assert.equal(result.disqualifiedReason, "more_than_max_days_late");
  assert.equal(result.finalCoins, 0);
});

// Never negative
test("a low-tier pair combined with heavy lateness never goes negative", () => {
  const result = calculatePairCoins({ percentage: 50, daysLate: 4 });
  assert.equal(result.baseCoins + result.bonusCoins - result.lateDeduction, 100);
  assert.equal(result.finalCoins, 100);
  assert.ok(result.finalCoins >= 0);
});

test("worked example from the spec: 82% with 1 day late = 700 Coins (500 base + 300 - 100)", () => {
  const result = calculatePairCoins({ percentage: 82, daysLate: 1 });
  assert.equal(result.baseCoins, 500);
  assert.equal(result.bonusCoins, 300);
  assert.equal(result.lateDeduction, 100);
  assert.equal(result.finalCoins, 700);
});
