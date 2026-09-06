import Link from "next/link";
import { notFound } from "next/navigation";
import { neueHaas } from "@/app/fonts";
import { authorizeAdministrator } from "@/lib/supabase/teacherAuth";
import { getAdminLearnerCoinHistory } from "@/lib/supabase/adminCoinReader";
import { resolveCoinTransactionTypeLabel } from "@/lib/coins/coinTransactionTypeLabels";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1. This is NOT the
// public share-token pattern -- there is no unauthenticated path to this
// data at all. Every request:
//   1. authorises the caller as a genuine administrator
//      (authorizeAdministrator(), the same canonical mechanism the
//      existing admin-only accessibility route already uses);
//   2. only THEN loads the requested learner's history.
// A guessed learner UUID never bypasses this -- authorization happens
// before the learnerId is ever used for anything, and a non-existent
// learner gets the exact same notFound() as an unauthorised caller.
// Read-only: no Coin-balance-editing action of any kind exists on this page.
export default async function TeacherAdminLearnerCoinHistoryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  if (!uuidPattern.test(learnerId)) {
    notFound();
  }

  const authorization = await authorizeAdministrator();
  if (!authorization.success) {
    notFound();
  }

  const history = await getAdminLearnerCoinHistory(learnerId);
  if (!history) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/teacher/admin/coins" className="text-sm font-semibold text-[#508DB1]">
            ← Back to Coin Management
          </Link>
          <h1 className={`${neueHaas.className} mt-2 text-2xl font-bold text-[#102A43]`}>
            {history.learnerName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">AD Astra Coin account</p>
        </div>

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
                    Source: {transaction.actorType === "system" ? "Automatic" : (transaction.actorName ?? transaction.actorType)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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
