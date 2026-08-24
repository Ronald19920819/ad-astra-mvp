// Canonical, pure AD Astra XP rules (Stage 1 -- locked policy).
//
// XP is earned ONLY from genuine completion, and is never affected by
// activity percentage, teacher/Kingdom mark, lateness, due date, or Coin
// eligibility. Coins (base/performance bonus/lateness deduction/Coin Gate
// unlocking) are a LATER stage and are not implemented here -- the Coin
// Gate check below is a read-only status calculation for audit purposes
// only, per this stage's explicit instructions; it awards nothing.
export const XP_PER_COMPLETED_LESSON = 200;
export const XP_PER_COMPLETED_ACTIVITY = 200;

export const COIN_GATE_XP_THRESHOLD = 2000;
export const COIN_GATE_MIN_LESSONS = 5;
export const COIN_GATE_MIN_ACTIVITIES = 5;

export function calculateXpTotal(
  completedLessonCount: number,
  completedActivityCount: number,
): number {
  return (
    completedLessonCount * XP_PER_COMPLETED_LESSON +
    completedActivityCount * XP_PER_COMPLETED_ACTIVITY
  );
}

export type CoinGateStatus = "locked" | "unlocked";

// Audit-only: reports whether a learner WOULD currently satisfy the locked
// Coin Gate requirements, all three simultaneously. Does not unlock, award,
// or persist anything -- Coin earning itself is a later stage.
export function evaluateCoinGateStatus(
  totalXp: number,
  completedLessonCount: number,
  completedActivityCount: number,
): CoinGateStatus {
  const meetsXp = totalXp >= COIN_GATE_XP_THRESHOLD;
  const meetsLessons = completedLessonCount >= COIN_GATE_MIN_LESSONS;
  const meetsActivities = completedActivityCount >= COIN_GATE_MIN_ACTIVITIES;

  return meetsXp && meetsLessons && meetsActivities ? "unlocked" : "locked";
}
