// Pure presentation-layer derivations for the learner XP & Coins experience
// (app/xp-coins, app/xp-coins/history, the Profile summary card, and the
// Home hero). Deliberately has NO "server-only" import and performs NO
// reward calculation of its own -- every number here is derived from
// values already produced by the canonical sources (lib/rewards/xpRules.ts,
// lib/rewards/coinRules.ts, lib/supabase/learnerXpReader.ts,
// lib/supabase/coinLedger.ts). This module exists so the UI never
// hardcodes 200 XP, Coin Gate thresholds, or Coin tier amounts
// independently, and so those derivations are directly unit-testable
// without mocking Supabase.
import {
  XP_PER_COMPLETED_LESSON,
  XP_PER_COMPLETED_ACTIVITY,
  COIN_GATE_XP_THRESHOLD,
  COIN_GATE_MIN_LESSONS,
  COIN_GATE_MIN_ACTIVITIES,
} from "./xpRules";
import {
  COIN_BASE_AWARD,
  COIN_LATE_DEDUCTION_PER_DAY,
  COIN_MAX_LATE_DAYS_BEFORE_ZERO,
  performanceBonus,
} from "./coinRules";

// ---------------------------------------------------------------------
// XP breakdown
// ---------------------------------------------------------------------
export type XpBreakdown = {
  lessonsCompleted: number;
  lessonXp: number;
  activitiesCompleted: number;
  activityXp: number;
  totalXp: number;
};

// lessonXp/activityXp are never independently authoritative -- they are
// the canonical completion counts (from getLearnerXpSummary) multiplied by
// the canonical per-unit constants (from xpRules.ts). totalXp here always
// reconciles exactly with calculateXpTotal(lessons, activities), covered
// by a regression test.
export function deriveXpBreakdown(
  lessonsCompleted: number,
  activitiesCompleted: number,
): XpBreakdown {
  const lessonXp = lessonsCompleted * XP_PER_COMPLETED_LESSON;
  const activityXp = activitiesCompleted * XP_PER_COMPLETED_ACTIVITY;
  return {
    lessonsCompleted,
    lessonXp,
    activitiesCompleted,
    activityXp,
    totalXp: lessonXp + activityXp,
  };
}

// ---------------------------------------------------------------------
// XP milestone achievements -- locked list, no stored achievement system.
// Recomputed fresh from live totalXp on every view; never persisted.
// ---------------------------------------------------------------------
export const XP_MILESTONES = [2000, 5000, 10000] as const;
export type XpMilestone = (typeof XP_MILESTONES)[number];

export function getReachedXpMilestones(totalXp: number): XpMilestone[] {
  return XP_MILESTONES.filter((milestone) => totalXp >= milestone);
}

// ---------------------------------------------------------------------
// Coin Gate progress
// ---------------------------------------------------------------------
export type CoinGateRequirement = {
  met: boolean;
  current: number;
  target: number;
};

export type CoinGateProgress = {
  xp: CoinGateRequirement;
  lessons: CoinGateRequirement;
  activities: CoinGateRequirement;
  // A specific, honest message naming the ONE remaining requirement when
  // exactly one is incomplete; a generic message when more than one is
  // incomplete (never invents which single requirement matters most);
  // null once the gate is unlocked (nothing left to progress toward).
  message: string | null;
};

export function describeCoinGateProgress(
  totalXp: number,
  lessonsCompleted: number,
  activitiesCompleted: number,
): CoinGateProgress {
  const xp: CoinGateRequirement = {
    met: totalXp >= COIN_GATE_XP_THRESHOLD,
    current: totalXp,
    target: COIN_GATE_XP_THRESHOLD,
  };
  const lessons: CoinGateRequirement = {
    met: lessonsCompleted >= COIN_GATE_MIN_LESSONS,
    current: lessonsCompleted,
    target: COIN_GATE_MIN_LESSONS,
  };
  const activities: CoinGateRequirement = {
    met: activitiesCompleted >= COIN_GATE_MIN_ACTIVITIES,
    current: activitiesCompleted,
    target: COIN_GATE_MIN_ACTIVITIES,
  };

  const incomplete = (
    [
      !xp.met ? ("xp" as const) : null,
      !lessons.met ? ("lessons" as const) : null,
      !activities.met ? ("activities" as const) : null,
    ] as const
  ).filter((requirement): requirement is "xp" | "lessons" | "activities" => requirement !== null);

  let message: string | null = null;
  if (incomplete.length === 1) {
    const only = incomplete[0];
    if (only === "xp") {
      const remaining = xp.target - xp.current;
      message = `Earn ${remaining.toLocaleString("en-US")} more XP to unlock Ad Astra Coins.`;
    } else if (only === "lessons") {
      const remaining = lessons.target - lessons.current;
      message = `Complete ${remaining} more ${remaining === 1 ? "lesson" : "lessons"} to unlock Ad Astra Coins.`;
    } else {
      const remaining = activities.target - activities.current;
      message = `Complete ${remaining} more ${remaining === 1 ? "activity" : "activities"} to unlock Ad Astra Coins.`;
    }
  } else if (incomplete.length > 1) {
    message = "Keep completing lessons and activities to unlock Ad Astra Coins.";
  }

  return { xp, lessons, activities, message };
}

// ---------------------------------------------------------------------
// "How You Earn Coins" tables -- generated from the canonical constants,
// never hardcoded amounts in a component.
// ---------------------------------------------------------------------
export type PerformanceTierRow = {
  rangeLabel: string;
  totalAward: number;
};

// Representative percentage sampled once per tier purely to read the
// canonical bonus for that tier via performanceBonus() -- the bonus
// function itself is the single source of truth, this never encodes a
// tier amount independently.
const PERFORMANCE_TIER_SAMPLES: { rangeLabel: string; samplePercentage: number }[] = [
  { rangeLabel: "50-59%", samplePercentage: 55 },
  { rangeLabel: "60-69%", samplePercentage: 65 },
  { rangeLabel: "70-79%", samplePercentage: 75 },
  { rangeLabel: "80-89%", samplePercentage: 85 },
  { rangeLabel: "90-99%", samplePercentage: 95 },
  { rangeLabel: "100%", samplePercentage: 100 },
];

export function getPerformanceTierRows(): PerformanceTierRow[] {
  return PERFORMANCE_TIER_SAMPLES.map(({ rangeLabel, samplePercentage }) => ({
    rangeLabel,
    totalAward: COIN_BASE_AWARD + performanceBonus(samplePercentage),
  }));
}

export type LatenessRow = { daysLate: string; deduction: string };

export function getLatenessRows(): LatenessRow[] {
  const rows: LatenessRow[] = [{ daysLate: "On time", deduction: "No deduction" }];
  for (let day = 1; day <= COIN_MAX_LATE_DAYS_BEFORE_ZERO; day += 1) {
    rows.push({
      daysLate: `${day} day${day === 1 ? "" : "s"} late`,
      deduction: `-${day * COIN_LATE_DEDUCTION_PER_DAY} AC`,
    });
  }
  rows.push({ daysLate: `More than ${COIN_MAX_LATE_DAYS_BEFORE_ZERO} days late`, deduction: "0 AC total" });
  return rows;
}

export const MAX_LINKED_PAIR_AWARD = COIN_BASE_AWARD + performanceBonus(100);

// ---------------------------------------------------------------------
// Coin ledger presentation
// ---------------------------------------------------------------------

// Given the learner's transactions newest-first (as returned by
// getLearnerCoinTransactions) and their current total balance (from
// getLearnerCoinBalance), derive the resulting balance immediately after
// each transaction. Pure arithmetic over the ledger's own established
// balance = SUM(amount) semantics -- introduces no new balance concept
// and never touches the database.
export function deriveResultingBalances(
  transactionsNewestFirst: readonly { amount: number }[],
  currentBalance: number,
): number[] {
  const balances: number[] = [];
  let runningBalance = currentBalance;
  for (const transaction of transactionsNewestFirst) {
    balances.push(runningBalance);
    runningBalance -= transaction.amount;
  }
  return balances;
}

const TRANSACTION_TYPE_FALLBACK_LABEL: Record<string, string> = {
  lesson_activity_reward: "Lesson & activity reward",
  admin_adjustment: "Ad Astra Coin adjustment",
  store_redemption: "Store redemption",
  ad_astra_contribution: "Ad Astra contribution",
  correction: "Balance correction",
  competition_award: "Competition award",
  promotional_award: "Promotional award",
  special_achievement: "Special achievement",
};

// Prefers the ledger's own human-readable `reason` (e.g. "Activity 7 -
// Lesson 3.7"); falls back to a friendly label per transaction_type for
// rows that don't have one. Never returns the raw enum value or any
// internal identifier.
export function describeTransactionSource(
  reason: string | null,
  transactionType: string,
): string {
  if (reason && reason.trim()) return reason.trim();
  return TRANSACTION_TYPE_FALLBACK_LABEL[transactionType] ?? "Ad Astra Coin transaction";
}

export function formatTransactionDate(createdAt: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(createdAt));
}
