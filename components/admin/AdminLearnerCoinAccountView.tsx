"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLearnerCoinHistory } from "@/lib/supabase/adminCoinReader";
import { resolveCoinTransactionTypeLabel } from "@/lib/coins/coinTransactionTypeLabels";
import { AdjustCoinsForm } from "@/components/admin/AdjustCoinsForm";

function formatCoins(amount: number): string {
  return `${amount.toLocaleString("en-ZA")} AC`;
}

function formatSignedCoins(amount: number): string {
  return `${amount > 0 ? "+" : ""}${amount.toLocaleString("en-ZA")} AC`;
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2. Client-owned so the
// "Adjust Coins" panel, its this-action-only success message, and the
// refreshed balance/history can update without a full browser reload.
// `history` is seeded from the Server Component page's own
// authorizeAdministrator()-gated fetch; after a successful adjustment
// this calls router.refresh() to re-run that exact same server fetch and
// receive fresh props -- never a separate client-side data-fetching path,
// and never an optimistic local balance edit that could drift from the
// ledger.
export function AdminLearnerCoinAccountView({
  learnerId,
  history,
}: {
  learnerId: string;
  history: AdminLearnerCoinHistory;
}) {
  const router = useRouter();
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleAdjusted(message: string) {
    setSuccessMessage(message);
    setIsAdjusting(false);
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat label="Current Balance" value={formatCoins(history.currentBalance)} />
        <SummaryStat label="Total Earned" value={formatCoins(history.totalEarned)} accent="text-green-700" />
        <SummaryStat
          label="Total Spent / Deducted"
          value={history.totalSpent > 0 ? formatCoins(history.totalSpent) : "—"}
          accent="text-red-600"
        />
      </div>

      <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
        {successMessage ? (
          <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">
            {successMessage}
          </p>
        ) : null}

        {isAdjusting ? (
          <AdjustCoinsForm
            learnerId={learnerId}
            learnerName={history.learnerName}
            currentBalance={history.currentBalance}
            recentTransactions={history.transactions}
            onCancel={() => setIsAdjusting(false)}
            onSuccess={handleAdjusted}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsAdjusting(true);
            }}
            className="rounded-2xl bg-[#102A43] px-5 py-2 text-sm font-bold text-white"
          >
            Adjust Coins
          </button>
        )}
      </section>

      <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-[#102A43]">Transaction History</h2>
        {history.transactions.length === 0 ? (
          <p className="text-sm text-slate-500">No Coin transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {history.transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-base font-bold ${transaction.amount > 0 ? "text-green-700" : "text-red-600"}`}
                  >
                    {formatSignedCoins(transaction.amount)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {resolveCoinTransactionTypeLabel(transaction.transactionType)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(transaction.createdAt)}</p>
                {transaction.reason ? (
                  <p className="mt-2 text-sm text-slate-700">{transaction.reason}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {[transaction.subjectName, transaction.lessonLabel, transaction.activityTitle]
                    .filter(Boolean)
                    .join(" · ") || "No lesson/activity attribution"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Source:{" "}
                  {transaction.actorType === "system"
                    ? "Automatic"
                    : transaction.actorType === "admin"
                      ? "Added by Administrator"
                      : (transaction.actorName ?? transaction.actorType)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold text-[#102A43] ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
