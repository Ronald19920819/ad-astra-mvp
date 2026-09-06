import Link from "next/link";
import { notFound } from "next/navigation";
import { neueHaas } from "@/app/fonts";
import { authorizeAdministrator } from "@/lib/supabase/teacherAuth";
import { getAdminCoinOverview } from "@/lib/supabase/adminCoinReader";
import { AdminCoinLearnerTable } from "@/components/admin/AdminCoinLearnerTable";

export const dynamic = "force-dynamic";

function formatCoins(amount: number): string {
  return `${amount.toLocaleString("en-ZA")} AC`;
}

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1. Read-only. Every
// figure here is computed from the immutable public.coin_transactions
// ledger (see lib/supabase/adminCoinReader.ts) -- never a cached balance,
// and never written to from this page. No Coin-balance-editing action of
// any kind exists anywhere on this page (Stage 2 scope).
export default async function TeacherAdminCoinsPage() {
  const authorization = await authorizeAdministrator();
  if (!authorization.success) {
    notFound();
  }

  const overview = await getAdminCoinOverview();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-16">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/teacher/admin" className="text-sm font-semibold text-[#508DB1]">
            ← Back to Administrator Hub
          </Link>
          <h1 className={`${neueHaas.className} mt-2 text-2xl font-bold text-[#102A43]`}>
            Coin Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only view of the AD Astra Coin economy, computed directly from the immutable Coin
            ledger.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryStat label="Total Coins in Circulation" value={formatCoins(overview.totalCoinsInCirculation)} />
          <SummaryStat label="Learners with Coins" value={String(overview.learnersWithCoins)} />
          <SummaryStat label="Total Coins Earned" value={formatCoins(overview.totalCoinsEarned)} accent="text-green-700" />
          <SummaryStat label="Total Coins Spent" value={formatCoins(overview.totalCoinsSpent)} accent="text-red-600" />
        </div>

        <AdminCoinLearnerTable learners={overview.learners} />
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
