"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shadows_Into_Light } from "next/font/google";
import { neueHaas } from "@/app/fonts";
import { createClient } from "@/lib/supabase/client";
import { LearnerAvatar } from "@/components/learners/LearnerAvatar";
import { useAuthenticatedLearnerProfile } from "@/lib/learners/useAuthenticatedLearnerProfile";
import { PasswordResetButton } from "@/components/profiles/PasswordResetButton";
import { describeCoinGateProgress } from "@/lib/rewards/learnerRewardsPresentation";
import {
  User,
  FileText,
  Coins,
  Settings,
  CreditCard,
  BookOpen,
  BookX,
  LogOut,
  Rocket,
  Unlock,
} from "lucide-react";

const shadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});



export default function ProfilePage() {
  const router = useRouter();
  const { profile, journey, rewards, isLoading } = useAuthenticatedLearnerProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const profileName =
    profile?.fullName ?? (isLoading ? "Loading profile..." : "Name unavailable");

  async function signOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError("Unable to sign out. Please try again.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Learner sign-out failed:", error);
      setSignOutError("Unable to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
   <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-28`}>
      <div className="max-w-md mx-auto">
        <section className="flex flex-col items-center text-center mb-6">
  <Image
    src="/ad_astra_logo.png"
    alt="AD Astra Logo"
    width={82}
    height={82}
    className="mb-4"
  />

  <Image
    src="/ad_astra_wordmark.png"
    alt="AD Astra"
    width={220}
    height={50}
    className="mb-2 h-auto w-auto"
  />

  <h1 className={`${shadowsIntoLight.className} mt-2 text-[34px] text-black leading-tight`}>
    {profileName}
  </h1>

  <p className="mt-1 text-sm font-medium text-black/60">
    Learner details and settings
  </p>

  <div className="relative mt-5">
    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
      {profile ? (
        <LearnerAvatar profile={profile} />
      ) : (
        <div
          aria-label={isLoading ? "Loading learner profile" : "Learner profile unavailable"}
          className="flex h-full w-full items-center justify-center bg-[#EEF7FF] text-sm font-semibold text-[#102A43]"
        >
          {isLoading ? "Loading..." : "Unavailable"}
        </div>
      )}
    </div>

    <div className="absolute bottom-1 right-1 rounded-full bg-[#102A43] px-3 py-1 text-xs font-semibold text-white shadow-sm">
      Edit
    </div>
  </div>
</section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <User size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Information
              </h2>
              <p className="text-xs font-medium text-black/50">
                Basic learner profile
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-black">
            <p><span className="font-semibold">Full Name:</span> {profileName}</p>
            <p className="break-all"><span className="font-semibold">Learner ID:</span> {profile?.learnerProfileId ?? (isLoading ? "Loading..." : "Unavailable")}</p>
            <p><span className="font-semibold">Email:</span> {profile?.email ?? "Not supplied"}</p>
            <p><span className="font-semibold">Subjects:</span> {profile?.enrolledSubjectCount ?? (isLoading ? "Loading..." : "0")}</p>
            <p>
              <span className="font-semibold">Approved subjects:</span>{" "}
              {profile?.approvedSubjects.length
                ? profile.approvedSubjects
                    .map((subject) => subject.name)
                    .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-semibold">Pending requests:</span>{" "}
              {profile?.pendingSubjects.length
                ? profile.pendingSubjects
                    .map((subject) => subject.name)
                    .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-semibold">Declined requests:</span>{" "}
              {profile?.declinedSubjects.length
                ? profile.declinedSubjects
                    .map((subject) => subject.name)
                    .join(", ")
                : "None"}
            </p>
            <p><span className="font-semibold">School:</span> {profile?.school ?? "Not supplied"}</p>
            <p><span className="font-semibold">Grade / Stage:</span> {profile?.gradeStage ?? "Not supplied"}</p>
            <p>
              <span className="font-semibold">Account status:</span>{" "}
              {profile?.accountStatus
                ? `${profile.accountStatus.charAt(0).toUpperCase()}${profile.accountStatus.slice(1)}`
                : isLoading
                  ? "Loading..."
                  : "Unavailable"}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Rocket size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                My AD Astra Journey
              </h2>
              <p className="text-xs font-medium text-black/50">
                Your progress across approved subjects
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="font-semibold text-black/60">
                Overall Subject Average
              </p>
              <p className="mt-1 text-xl font-bold text-[#102A43]">
                {journey?.overallSubjectAverage === null ||
                journey?.overallSubjectAverage === undefined
                  ? "Not available"
                  : `${Math.round(journey.overallSubjectAverage * 10) / 10}%`}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FFF8E6] p-4">
              <p className="font-semibold text-black/60">
                Current Achievement
              </p>
              <p className="mt-1 font-bold text-[#D9A106]">
                {journey?.currentAchievement ?? "Mission Not Started"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="font-semibold text-black/60">Active Subjects</p>
              <p className="mt-1 text-xl font-bold text-[#102A43]">
                {journey?.activeSubjects ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="font-semibold text-black/60">
                Completed Activities
              </p>
              <p className="mt-1 text-xl font-bold text-[#102A43]">
                {journey?.completedActivities ?? 0}
              </p>
            </div>
          </div>

          {!isLoading && (journey?.activeSubjects ?? 0) === 0 && (
            <p className="mt-4 text-sm text-black/60">
              Your progress will appear after subjects are approved and marked
              activities become available.
            </p>
          )}

          <Link
            href="/your-work"
            className="mt-4 block w-full rounded-2xl bg-[#102A43] py-3 text-center text-sm font-semibold text-white"
          >
            View My Work
          </Link>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <FileText size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Report Card
              </h2>
              <p className="text-xs font-medium text-black/50">
                Teacher progress updates
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
            Access progress reports generated and sent by teachers every two months.
          </p>

          <button className="w-full rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white shadow-sm">
            View Reports
          </button>
        </section>

        <section className="mb-5 rounded-[2rem] border border-yellow-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF8E6] p-3 text-[#D9A106]">
              <Coins size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                XP &amp; AD Astra Coins
              </h2>
              <p className="text-xs font-medium text-black/50">
                Your progression snapshot
              </p>
            </div>
          </div>

          {rewards && (rewards.xp || rewards.acBalance !== null) ? (
            <>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  {rewards.xp ? (
                    <p className="text-2xl font-bold text-[#102A43]">
                      {rewards.xp.totalXp.toLocaleString("en-US")} XP
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-black/40">XP unavailable</p>
                  )}
                  <p className="text-xs font-medium text-black/50">Experience</p>
                </div>
                <div>
                  {rewards.acBalance !== null ? (
                    <p className="text-2xl font-bold text-[#D9A106]">
                      {rewards.acBalance.toLocaleString("en-US")} AC
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-black/40">AC unavailable</p>
                  )}
                  <p className="text-xs font-medium text-black/50">Ad Astra Coins</p>
                </div>
                {rewards.xp?.coinGateStatus === "unlocked" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <Unlock size={14} /> COIN GATE UNLOCKED
                  </span>
                )}
              </div>

              {rewards.xp?.coinGateStatus === "locked" &&
                (() => {
                  const xpSummary = rewards.xp!;
                  const gateProgress = describeCoinGateProgress(
                    xpSummary.totalXp,
                    xpSummary.totalLessonsCompleted,
                    xpSummary.totalActivitiesCompleted,
                  );
                  return (
                    <div className="mt-4 rounded-2xl bg-[#F8FBFF] p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-black/50">
                        Coin Gate
                      </p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-black/60">XP</span>
                          <span className="font-semibold text-[#102A43]">
                            {gateProgress.xp.current.toLocaleString("en-US")} /{" "}
                            {gateProgress.xp.target.toLocaleString("en-US")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-black/60">Lessons</span>
                          <span className="font-semibold text-[#102A43]">
                            {gateProgress.lessons.current} / {gateProgress.lessons.target}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-black/60">Activities</span>
                          <span className="font-semibold text-[#102A43]">
                            {gateProgress.activities.current} / {gateProgress.activities.target}
                          </span>
                        </div>
                      </div>
                      {gateProgress.message && (
                        <p className="mt-3 text-sm font-medium text-[#508DB1]">
                          {gateProgress.message}
                        </p>
                      )}
                    </div>
                  );
                })()}

              <Link
                href="/xp-coins"
                className="mt-4 block w-full rounded-2xl bg-[#102A43] py-3 text-center text-sm font-semibold text-white"
              >
                View XP &amp; Coins
              </Link>
            </>
          ) : (
            <p className="text-sm text-black/60">
              {isLoading ? "Loading your XP & Coins..." : "Unable to load your XP & Coins right now."}
            </p>
          )}
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Settings size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Settings
              </h2>
              <p className="text-xs font-medium text-black/50">
                Manage learner account
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <PasswordResetButton className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black disabled:opacity-60" />

            <Link
              href="/onboarding/subjects"
              className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black"
            >
              <BookOpen size={18} className="text-[#508DB1]" />
              Register for Additional Subjects
            </Link>

            <Link
              href="/onboarding/subjects"
              className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black"
            >
              <BookX size={18} className="text-[#508DB1]" />
              Deregister Subjects
            </Link>

            <button
              type="button"
              onClick={() =>
                setSettingsNotice("Subscription upgrades are not available yet.")
              }
              className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black"
            >
              <CreditCard size={18} className="text-[#508DB1]" />
              Upgrade Subscription Plan
            </button>

            {settingsNotice && (
              <p className="rounded-2xl bg-[#EEF7FF] px-4 py-3 text-sm font-medium text-[#102A43]">
                {settingsNotice}
              </p>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-red-600 disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={18} aria-hidden="true" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </button>

            {signOutError && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {signOutError}
              </p>
            )}
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/home">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/chat">
            <div className="py-4">Chat</div>
          </Link>

          <Link href="/schedule">
            <div className="py-4">Schedule</div>
          </Link>

          <Link href="/profile">
            <div className="py-4 text-[#508DB1]">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}
