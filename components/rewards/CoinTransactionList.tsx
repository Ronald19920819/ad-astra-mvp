import type { CoinTransactionRow } from "@/lib/supabase/coinLedger";
import {
  deriveResultingBalances,
  describeTransactionSource,
  formatTransactionDate,
} from "@/lib/rewards/learnerRewardsPresentation";

// Shared row renderer for both the "Recent Coin Activity" preview on
// /xp-coins and the full /xp-coins/history list -- one presentation of the
// canonical ledger, never a second transaction model. Callers pass exactly
// the (possibly sliced) transactions they want shown, newest first, plus
// the learner's current balance; resulting-balance-per-row is derived here
// via the same pure helper either caller would otherwise have to call
// itself.
export function CoinTransactionList({
  transactions,
  currentBalance,
  emptyMessage = "No Coin activity yet.",
}: {
  transactions: CoinTransactionRow[];
  // null when the current balance failed to load independently of the
  // transaction list itself -- the list still renders (date/source/
  // amount), just without a resulting-balance column, rather than hiding
  // genuine transaction history over an unrelated failure.
  currentBalance: number | null;
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-2xl bg-[#F8FBFF] p-4 text-sm text-slate-500">{emptyMessage}</p>
    );
  }

  const resultingBalances =
    currentBalance !== null ? deriveResultingBalances(transactions, currentBalance) : null;

  return (
    <ul className="divide-y divide-blue-50">
      {transactions.map((transaction, index) => {
        const isPositive = transaction.amount > 0;
        return (
          <li
            key={transaction.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#102A43]">
                {describeTransactionSource(transaction.reason, transaction.transaction_type)}
              </p>
              <p className="text-xs font-medium text-slate-500">
                {formatTransactionDate(transaction.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-bold ${isPositive ? "text-emerald-700" : "text-rose-700"}`}
              >
                {isPositive ? "+" : ""}
                {transaction.amount.toLocaleString("en-US")} AC
              </p>
              {resultingBalances && (
                <p className="text-xs font-medium text-slate-500">
                  {resultingBalances[index].toLocaleString("en-US")} AC balance
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
