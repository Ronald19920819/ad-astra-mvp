import Link from "next/link";
import { ArrowLeft, Coins } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { CoinTransactionList } from "@/components/rewards/CoinTransactionList";
import { getCurrentLearnerContext } from "@/lib/supabase/currentLearnerContext";
import { getLearnerRewardsSummary } from "@/lib/supabase/learnerRewardsSummary";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

export const dynamic = "force-dynamic";

export default async function CoinHistoryPage() {
  const context = await getCurrentLearnerContext();

  if (context.status !== "success") {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}>
        <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">{context.message}</p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-[#508DB1]">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  let summary;
  try {
    summary = await getLearnerRewardsSummary(context.identity.learnerId);
  } catch (error) {
    logSupabaseError("Unable to load learner Coin history:", error);
  }

  if (!summary) {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}>
        <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            Unable to load your Coin history right now. Please try again shortly.
          </p>
          <Link href="/xp-coins" className="mt-4 inline-block text-sm font-semibold text-[#508DB1]">
            Back to XP & Coins
          </Link>
        </div>
      </main>
    );
  }

  const { acBalance, transactions } = summary;

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-28 sm:p-6 lg:px-8`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-3xl">
        <Link
          href="/xp-coins"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#508DB1]"
        >
          <ArrowLeft size={17} /> Back to XP & Coins
        </Link>

        <section className="rounded-[2rem] border border-blue-100 bg-[#102A43] p-6 text-white shadow-lg lg:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Coin History</p>
          <p className="mt-3 text-4xl font-extrabold text-[#F5C453]">
            {acBalance !== null ? `${acBalance.toLocaleString("en-US")} AC` : "Balance unavailable"}
          </p>
          <p className="mt-1 text-sm font-semibold text-blue-100">Current balance</p>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Coins size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#102A43]">All Coin Activity</h1>
              <p className="text-xs font-medium text-black/50">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"}, newest first
              </p>
            </div>
          </div>
          <CoinTransactionList
            transactions={transactions}
            currentBalance={acBalance}
            emptyMessage="You haven't earned or spent any Coins yet."
          />
        </section>
      </div>
    </main>
  );
}
