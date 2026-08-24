import assert from "node:assert/strict";
import test from "node:test";
import {
  COIN_GATE_MIN_ACTIVITIES,
  COIN_GATE_MIN_LESSONS,
  COIN_GATE_XP_THRESHOLD,
  XP_PER_COMPLETED_ACTIVITY,
  XP_PER_COMPLETED_LESSON,
  calculateXpTotal,
  evaluateCoinGateStatus,
} from "./xpRules";

test("locked rule constants match the spec exactly", () => {
  assert.equal(XP_PER_COMPLETED_LESSON, 200);
  assert.equal(XP_PER_COMPLETED_ACTIVITY, 200);
  assert.equal(COIN_GATE_XP_THRESHOLD, 2000);
  assert.equal(COIN_GATE_MIN_LESSONS, 5);
  assert.equal(COIN_GATE_MIN_ACTIVITIES, 5);
});

// Completed lesson = 200 XP
test("a single completed lesson is worth 200 XP", () => {
  assert.equal(calculateXpTotal(1, 0), 200);
});

// Submitted activity scoring 35% = 200 XP (percentage never affects XP)
test("XP is unaffected by activity percentage -- only genuine submission counts", () => {
  assert.equal(calculateXpTotal(0, 1), 200);
});

// Completed lesson + submitted activity = 400 XP
test("a completed lesson plus its linked activity totals 400 XP", () => {
  assert.equal(calculateXpTotal(1, 1), 400);
});

test("XP scales linearly with genuine completion counts, nothing else", () => {
  assert.equal(calculateXpTotal(7, 6), 7 * 200 + 6 * 200);
  assert.equal(calculateXpTotal(0, 0), 0);
});

// Coin Gate examples from the spec (audit-only; no Coins awarded).
test("2,000 XP + 9 lessons + 1 activity is LOCKED (fails the activity-count leg)", () => {
  assert.equal(evaluateCoinGateStatus(2000, 9, 1), "locked");
});

test("2,800 XP + 0 lessons + 14 activities is LOCKED (fails the lesson-count leg)", () => {
  assert.equal(evaluateCoinGateStatus(2800, 0, 14), "locked");
});

test("2,000 XP + 5 lessons + 5 activities is UNLOCKED (exactly meets all three)", () => {
  assert.equal(evaluateCoinGateStatus(2000, 5, 5), "unlocked");
});

test("2,400 XP + 6 lessons + 6 activities is UNLOCKED", () => {
  assert.equal(evaluateCoinGateStatus(2400, 6, 6), "unlocked");
});

test("high XP alone, without enough lessons AND activities, stays LOCKED", () => {
  assert.equal(evaluateCoinGateStatus(10000, 4, 4), "locked");
});

test("all three legs must hold simultaneously, not just XP", () => {
  assert.equal(evaluateCoinGateStatus(1999, 5, 5), "locked");
  assert.equal(evaluateCoinGateStatus(2000, 4, 5), "locked");
  assert.equal(evaluateCoinGateStatus(2000, 5, 4), "locked");
});
