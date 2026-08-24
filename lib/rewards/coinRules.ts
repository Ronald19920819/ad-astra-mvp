// Canonical, pure AD Astra Coin rules (Stage 3 -- locked policy).
//
// Coins are earned from a LINKED lesson+activity pair, once, only after:
//   - the Coin Gate is unlocked (see evaluateCoinGateStatus in
//     lib/rewards/xpRules.ts -- reused unchanged, not redefined here)
//   - both halves are genuinely complete (canonical Stage 1 sources)
//   - the activity has an AUTHORITATIVE TEACHER-FINAL mark (never a
//     Kingdom/AI preliminary mark)
//   - a valid authoritative due date exists for the pair
//   - the pair is not more than 4 days late
//
// This module is deliberately pure (no Supabase, no server-only) so the
// reward arithmetic itself is directly testable and has exactly one
// definition, reused by both the write path (lib/supabase/coinLedger.ts)
// and the read-only preview path (lib/supabase/coinEarningEngine.ts).
export const COIN_MIN_PERFORMANCE_PERCENTAGE = 50;
export const COIN_BASE_AWARD = 500;
export const COIN_MAX_LATE_DAYS_BEFORE_ZERO = 4;
export const COIN_LATE_DEDUCTION_PER_DAY = 100;

// 100 Coins = R1 nominal value (reward-economy planning only -- never a
// cash/payment record).
export const COIN_TO_RAND_NOMINAL_RATE = 100;

export function coinsToNominalRand(coins: number): number {
  return coins / COIN_TO_RAND_NOMINAL_RATE;
}

// 50-59% -> +0, 60-69% -> +100, ... 100% -> +500.
export function performanceBonus(percentage: number): number {
  if (percentage >= 100) return 500;
  if (percentage >= 90) return 400;
  if (percentage >= 80) return 300;
  if (percentage >= 70) return 200;
  if (percentage >= 60) return 100;
  return 0; // 50-59%
}

export type PairCoinCalculationInput = {
  // Percentage computed from the FROZEN submission mark basis
  // (original_total_marks / activity_snapshot), on the AUTHORITATIVE
  // TEACHER-FINAL mark only -- callers must never pass a Kingdom/AI
  // preliminary percentage here.
  percentage: number;
  // Whole days late, computed from MAX(lessonCompletionTimestamp,
  // activitySubmissionTimestamp) vs the authoritative shared due date.
  // 0 (or negative, clamped to 0 by the caller) means on time.
  daysLate: number;
};

export type PairCoinCalculationResult = {
  qualifies: boolean;
  disqualifiedReason: "below_minimum_performance" | "more_than_max_days_late" | null;
  baseCoins: number;
  bonusCoins: number;
  lateDeduction: number;
  finalCoins: number;
};

// The one and only place the base+bonus-minus-deduction formula is
// computed. A pair that doesn't qualify never reaches a positive amount --
// callers must not create a ledger transaction for a non-qualifying pair
// (finalCoins is always 0 in that case, and a zero-amount transaction is
// rejected by the coin_transactions table's own CHECK constraint).
export function calculatePairCoins(
  input: PairCoinCalculationInput,
): PairCoinCalculationResult {
  if (input.percentage < COIN_MIN_PERFORMANCE_PERCENTAGE) {
    return {
      qualifies: false,
      disqualifiedReason: "below_minimum_performance",
      baseCoins: 0,
      bonusCoins: 0,
      lateDeduction: 0,
      finalCoins: 0,
    };
  }

  if (input.daysLate > COIN_MAX_LATE_DAYS_BEFORE_ZERO) {
    return {
      qualifies: false,
      disqualifiedReason: "more_than_max_days_late",
      baseCoins: 0,
      bonusCoins: 0,
      lateDeduction: 0,
      finalCoins: 0,
    };
  }

  const baseCoins = COIN_BASE_AWARD;
  const bonusCoins = performanceBonus(input.percentage);
  const lateDeduction = Math.max(0, input.daysLate) * COIN_LATE_DEDUCTION_PER_DAY;
  const finalCoins = Math.max(0, baseCoins + bonusCoins - lateDeduction);

  return {
    qualifies: true,
    disqualifiedReason: null,
    baseCoins,
    bonusCoins,
    lateDeduction,
    finalCoins,
  };
}
