import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Coins,
  Lock,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  Unlock,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { CoinTransactionList } from "@/components/rewards/CoinTransactionList";
import {
  deriveXpBreakdown,
  describeCoinGateProgress,
  getLatenessRows,
  getPerformanceTierRows,
  getReachedXpMilestones,
  MAX_LINKED_PAIR_AWARD,
} from "@/lib/rewards/learnerRewardsPresentation";
import { COIN_BASE_AWARD, coinsToNominalRand } from "@/lib/rewards/coinRules";
import { getCurrentLearnerContext } from "@/lib/supabase/currentLearnerContext";
import { getLearnerRewardsSummary } from "@/lib/supabase/learnerRewardsSummary";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

export const dynamic = "force-dynamic";

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-[#102A43]">{title}</h2>
          {subtitle && <p className="text-xs font-medium text-black/50">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function XpCoinsPage() {
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
    logSupabaseError("Unable to load learner rewards summary:", error);
  }

  // getLearnerRewardsSummary itself never throws (it degrades each of its
  // three reads independently) -- this only triggers on a genuinely
  // unexpected failure above. xp is the one field nearly everything below
  // depends on (Coin Gate status lives on it), so a null xp gets its own
  // honest error state rather than rendering a broken/partial dashboard.
  if (!summary || !summary.xp) {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}>
        <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            Unable to load your XP & Coins right now. Please try again shortly.
          </p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-[#508DB1]">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const { xp, transactions } = summary;
  // acBalance can independently be null (a genuine load failure, never a
  // fake 0) even though xp succeeded -- everything below that needs a
  // number falls back to 0 for display math only where explicitly noted;
  // the raw value shown to the learner always distinguishes "0 AC" from
  // "unavailable".
  const acBalance = summary.acBalance;
  const breakdown = deriveXpBreakdown(xp.totalLessonsCompleted, xp.totalActivitiesCompleted);
  const gateUnlocked = xp.coinGateStatus === "unlocked";
  const gateProgress = describeCoinGateProgress(
    xp.totalXp,
    xp.totalLessonsCompleted,
    xp.totalActivitiesCompleted,
  );
  const reachedMilestones = getReachedXpMilestones(xp.totalXp);
  const recentTransactions = transactions.slice(0, 5);
  const performanceTiers = getPerformanceTierRows();
  const latenessRows = getLatenessRows();
  const approxRandValue = acBalance !== null ? coinsToNominalRand(acBalance) : null;

  const achievements: { key: string; icon: React.ReactNode; label: string; detail: string }[] = [];
  if (gateUnlocked) {
    achievements.push({
      key: "coin-gate",
      icon: <Unlock size={20} />,
      label: "Coin Gate Unlocked",
      detail: "You've met all three requirements to start earning Ad Astra Coins.",
    });
  }
  for (const milestone of reachedMilestones) {
    achievements.push({
      key: `xp-${milestone}`,
      icon: <Star size={20} />,
      label: `${milestone.toLocaleString("en-US")} XP Reached`,
      detail: "A genuine progression milestone based on your completed work.",
    });
  }

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-28 sm:px-6 sm:pt-6 lg:px-8`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-6xl">
        <Link
          href="/profile"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#508DB1]"
        >
          <ArrowLeft size={17} /> Back to Profile
        </Link>

        {/* A. Full-width progress hero */}
        <section className="rounded-[2rem] border border-blue-100 bg-[#102A43] p-6 text-white shadow-lg lg:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Your Progress</p>
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
            <div>
              <p className="text-5xl font-extrabold leading-none lg:text-6xl">
                {xp.totalXp.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-blue-200">
                Experience Points
              </p>
            </div>
            <div>
              <p className="text-5xl font-extrabold leading-none text-[#F5C453] lg:text-6xl">
                {acBalance !== null ? acBalance.toLocaleString("en-US") : "—"}
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#E8C989]">
                Ad Astra Coins
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            {gateUnlocked ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">
                <Unlock size={16} /> COIN GATE UNLOCKED
              </div>
            ) : (
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
                  <Lock size={16} /> COIN GATE LOCKED
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-100">
                      <span>XP</span>
                      <span>
                        {gateProgress.xp.current.toLocaleString("en-US")} /{" "}
                        {gateProgress.xp.target.toLocaleString("en-US")}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${gateProgress.xp.met ? "bg-emerald-400" : "bg-[#F5C453]"}`}
                        style={{
                          width: `${Math.min(100, Math.round((gateProgress.xp.current / gateProgress.xp.target) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-100">
                      <span>Lessons</span>
                      <span>
                        {gateProgress.lessons.current} / {gateProgress.lessons.target}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${gateProgress.lessons.met ? "bg-emerald-400" : "bg-[#F5C453]"}`}
                        style={{
                          width: `${Math.min(100, Math.round((gateProgress.lessons.current / gateProgress.lessons.target) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-100">
                      <span>Activities</span>
                      <span>
                        {gateProgress.activities.current} / {gateProgress.activities.target}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${gateProgress.activities.met ? "bg-emerald-400" : "bg-[#F5C453]"}`}
                        style={{
                          width: `${Math.min(100, Math.round((gateProgress.activities.current / gateProgress.activities.target) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {gateProgress.message && (
                  <p className="mt-4 text-sm font-medium text-blue-100">{gateProgress.message}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* B. Two-column: XP Progress | Ad Astra Coins */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="XP Progress" subtitle="How your experience points add up" icon={<Sparkles size={22} />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[#F8FBFF] p-4">
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-[#508DB1]" />
                  <div>
                    <p className="text-sm font-semibold text-[#102A43]">Lessons completed</p>
                    <p className="text-xs text-black/50">{breakdown.lessonsCompleted} lessons</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-[#102A43]">
                  {breakdown.lessonXp.toLocaleString("en-US")} XP
                </p>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#F8FBFF] p-4">
                <div className="flex items-center gap-3">
                  <ClipboardList size={18} className="text-[#508DB1]" />
                  <div>
                    <p className="text-sm font-semibold text-[#102A43]">Activities completed</p>
                    <p className="text-xs text-black/50">{breakdown.activitiesCompleted} activities</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-[#102A43]">
                  {breakdown.activityXp.toLocaleString("en-US")} XP
                </p>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#102A43] p-4 text-white">
                <p className="text-sm font-bold uppercase tracking-[0.1em]">Total XP</p>
                <p className="text-xl font-extrabold">{breakdown.totalXp.toLocaleString("en-US")}</p>
              </div>
            </div>
          </Card>

          <Card title="Ad Astra Coins" subtitle="Your current spendable balance" icon={<Coins size={22} />}>
            <div className="flex flex-col items-start gap-1">
              {acBalance !== null ? (
                <>
                  <p className="text-4xl font-extrabold text-[#D9A106]">
                    {acBalance.toLocaleString("en-US")} AC
                  </p>
                  <p className="text-sm font-semibold text-black/50">Ad Astra Coins</p>
                  <p className="mt-2 text-sm text-black/60">
                    100 AC = R1 &middot; Approx. reward value: R{approxRandValue!.toLocaleString("en-US")}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-black/40">
                  Unable to load your Coin balance right now.
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <span
                className="flex-1 cursor-not-allowed rounded-2xl border border-blue-100 bg-[#F8FBFF] py-3 text-center text-sm font-semibold text-black/40"
                title="The Ad Astra Store is coming soon."
              >
                View Store
              </span>
              <Link
                href="/xp-coins/history"
                className="flex-1 rounded-2xl bg-[#102A43] py-3 text-center text-sm font-semibold text-white"
              >
                Coin History
              </Link>
            </div>
          </Card>
        </div>

        {/* C. Two-column: How You Earn Coins | Recent Coin Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="How You Earn Coins" subtitle="Complete a linked lesson + activity" icon={<Trophy size={22} />}>
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#FFF8E6] p-4">
              <p className="text-sm font-semibold text-[#102A43]">Qualifying lesson + activity</p>
              <p className="text-lg font-bold text-[#D9A106]">{COIN_BASE_AWARD} AC</p>
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-black/50">
              Performance bonus
            </p>
            <ul className="mb-4 divide-y divide-blue-50 text-sm">
              {performanceTiers.map((tier) => (
                <li key={tier.rangeLabel} className="flex items-center justify-between py-2">
                  <span className="text-black/70">{tier.rangeLabel}</span>
                  <span className="font-semibold text-[#102A43]">{tier.totalAward} AC total</span>
                </li>
              ))}
            </ul>
            <p className="mb-3 text-sm font-semibold text-[#102A43]">
              Maximum award for one linked pair: {MAX_LINKED_PAIR_AWARD} AC
            </p>
            <p className="mb-3 text-sm text-black/60">
              Complete work on time to keep your full reward. Late work earns fewer Coins.
            </p>
            <details className="rounded-2xl bg-[#F8FBFF] p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-[#508DB1]">View lateness rules</summary>
              <ul className="mt-3 divide-y divide-blue-100">
                {latenessRows.map((row) => (
                  <li key={row.daysLate} className="flex items-center justify-between py-2">
                    <span className="text-black/70">{row.daysLate}</span>
                    <span className="font-semibold text-[#102A43]">{row.deduction}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>

          <Card title="Recent Coin Activity" subtitle="Your latest Ad Astra Coin transactions" icon={<Coins size={22} />}>
            <CoinTransactionList
              transactions={recentTransactions}
              currentBalance={acBalance}
              emptyMessage="You haven't earned any Coins yet."
            />
            <Link
              href="/xp-coins/history"
              className="mt-4 block w-full rounded-2xl border border-blue-100 bg-[#F8FBFF] py-3 text-center text-sm font-semibold text-[#508DB1]"
            >
              View Full Coin History
            </Link>
          </Card>
        </div>

        {/* D. Full-width Achievements */}
        <Card title="Your Achievements" subtitle="Genuine progress milestones" icon={<Trophy size={22} />}>
          {achievements.length === 0 ? (
            <p className="rounded-2xl bg-[#F8FBFF] p-4 text-sm text-slate-500">
              Keep completing lessons and activities to earn your first achievement.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.key}
                  className="rounded-2xl border border-yellow-200 bg-[#FFF8E6] p-4"
                >
                  <div className="mb-2 inline-flex rounded-xl bg-[#D9A106]/15 p-2 text-[#D9A106]">
                    {achievement.icon}
                  </div>
                  <p className="text-sm font-bold text-[#102A43]">{achievement.label}</p>
                  <p className="mt-1 text-xs text-black/60">{achievement.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* E. Full-width Store preview */}
        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm lg:p-10">
          <div className="mx-auto mb-3 inline-flex rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
            <ShoppingBag size={22} />
          </div>
          <h2 className="text-lg font-bold text-[#102A43]">AD ASTRA STORE</h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-[#508DB1]">
            Coming Soon
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-black/60">
            Soon you&apos;ll be able to use your Ad Astra Coins toward real Ad Astra rewards.
          </p>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4 text-[#508DB1]">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}
