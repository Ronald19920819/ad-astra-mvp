import "server-only";

import { getLearnerXpSummary, type LearnerXpSummary } from "@/lib/supabase/learnerXpReader";
import {
  getLearnerCoinBalance,
  getLearnerCoinTransactions,
  type CoinTransactionRow,
} from "@/lib/supabase/coinLedger";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

// THE single assembler for "this learner's current XP/AC/Coin Gate state" --
// Home, Profile, and the XP & Coins dashboard all call this instead of each
// independently orchestrating the same three canonical reads. Deliberately
// does NOT calculate anything: it only calls the existing canonical
// sources (lib/supabase/learnerXpReader.ts, lib/supabase/coinLedger.ts) and
// returns their outputs together. Any XP/Coin/Coin-Gate arithmetic still
// lives exactly where it already did -- this must never grow into a second
// calculation engine.
//
// The three reads are independently fault-tolerant (Promise.allSettled,
// not Promise.all), matching app/home/page.tsx's pre-existing, deliberate
// behaviour: XP and AC can fail independently (e.g. a migration live for
// one table but not another), and each should degrade to null on its own
// rather than one failure blanking out data that loaded successfully.
export type LearnerRewardsSummary = {
  // null = genuine load failure, never rendered as a fake 0. Distinct from
  // a learner who legitimately has 0 XP/AC, which resolves to the real
  // number 0.
  xp: LearnerXpSummary | null;
  acBalance: number | null;
  // Full transaction history, newest first -- exactly
  // getLearnerCoinTransactions()'s own ordering. Callers slice this for a
  // "recent activity" preview rather than a second, differently-scoped
  // query. Empty array on load failure (never null -- an empty ledger and
  // a failed load render the same "nothing to show" empty state here,
  // since there's no non-list value to fall back to).
  transactions: CoinTransactionRow[];
};

export async function getLearnerRewardsSummary(
  learnerAuthUserId: string,
): Promise<LearnerRewardsSummary> {
  const [xpResult, acBalanceResult, transactionsResult] = await Promise.allSettled([
    getLearnerXpSummary(learnerAuthUserId),
    getLearnerCoinBalance(learnerAuthUserId),
    getLearnerCoinTransactions(learnerAuthUserId),
  ]);

  if (xpResult.status === "rejected") {
    logSupabaseError("Unable to load learner XP summary:", xpResult.reason);
  }
  if (acBalanceResult.status === "rejected") {
    logSupabaseError("Unable to load learner Coin balance:", acBalanceResult.reason);
  }
  if (transactionsResult.status === "rejected") {
    logSupabaseError("Unable to load learner Coin transactions:", transactionsResult.reason);
  }

  return {
    xp: xpResult.status === "fulfilled" ? xpResult.value : null,
    acBalance: acBalanceResult.status === "fulfilled" ? acBalanceResult.value : null,
    transactions: transactionsResult.status === "fulfilled" ? transactionsResult.value : [],
  };
}
