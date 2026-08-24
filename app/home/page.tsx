import Link from "next/link";
import HeroBanner from "@/components/HeroBanner";
import MotivationalCard from "@/components/MotivationalCard";
import TutorSuggestion from "@/components/TutorSuggestion";
import { Next24HoursCard } from "@/components/home/Next24HoursCard";
import { TeacherAnnouncementsCard } from "@/components/home/TeacherAnnouncementsCard";
import SchoolOverviewCard from "@/components/SchoolOverviewCard";
import { getLearnerCoinBalance } from "@/lib/supabase/coinLedger";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { getLearnerXpSummary } from "@/lib/supabase/learnerXpReader";
import {
  getLearnerHomeCommunications,
  type LearnerHomeCommunications,
} from "@/lib/supabase/subjectCommunications";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

export const dynamic = "force-dynamic";

export default async function HomeDashboard() {
  const profile = await getAuthenticatedLearnerProfile();
  const learnerName = profile?.displayName ?? "Learner";
  let loadError = "";
  let communications: LearnerHomeCommunications = {
    next24Hours: [],
    announcements: [],
  };

  // Resolved server-side, before the page renders, so there is no
  // client-side loading state and never a flash of a fake "0 XP" --
  // the canonical Stage 1 reader is the sole source of this value.
  // A failure here degrades gracefully: the hero simply omits the XP
  // display rather than breaking the dashboard or surfacing the error.
  let xpTotal: number | null = null;
  if (profile) {
    try {
      const xpSummary = await getLearnerXpSummary(profile.userId);
      xpTotal = xpSummary.totalXp;
    } catch (error) {
      logSupabaseError("Unable to load learner XP summary:", error);
    }
  }

  // Authoritative Stage 3 ledger balance -- SUM(coin_transactions.amount)
  // for this learner, server-side, via getLearnerCoinBalance. A genuinely
  // empty ledger resolves to the real number 0 (renders "0 AC", per the
  // locked "zero balances must display" rule) and is NOT the same thing
  // as a failed load (e.g. the coin_transactions table/migration not yet
  // live in this environment) -- a failure here logs and leaves acBalance
  // null, which the hero simply omits rather than guessing a balance.
  let acBalance: number | null = null;
  if (profile) {
    try {
      acBalance = await getLearnerCoinBalance(profile.userId);
    } catch (error) {
      logSupabaseError("Unable to load learner Coin balance:", error);
    }
  }

  if (profile) {
    try {
      communications = await getLearnerHomeCommunications(profile);
    } catch (error) {
      logSupabaseError("Unable to load learner home communications:", error);
      loadError = "Unable to load the latest dashboard updates.";
    }
  } else {
    loadError = "Unable to load your learner dashboard.";
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 pb-28 lg:px-8">
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <HeroBanner learnerName={learnerName} xpTotal={xpTotal} acBalance={acBalance} />

        <MotivationalCard />

        {profile ? (
          <>
            <div className="lg:space-y-8">
              <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">
                <Next24HoursCard items={communications.next24Hours} />
                <TeacherAnnouncementsCard
                  announcements={communications.announcements}
                />
              </div>

              {loadError ? (
                <p className="mb-5 rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm lg:mb-0">
                  {loadError}
                </p>
              ) : null}

              <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">
                <SchoolOverviewCard />
                <TutorSuggestion />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mb-5 rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
              {loadError}
            </p>
            <TutorSuggestion />
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm font-semibold text-black lg:max-w-6xl">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}