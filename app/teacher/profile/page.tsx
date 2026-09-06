"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shadows_Into_Light } from "next/font/google";
import { neueHaas } from "@/app/fonts";
import { createClient } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import { PasswordResetButton } from "@/components/profiles/PasswordResetButton";
import { useAuthenticatedTeacherProfile } from "@/lib/teachers/useAuthenticatedTeacherProfile";
import {
  User,
  GraduationCap,
  Coins,
  Settings,
  Archive,
  BookOpen,
  CreditCard,
  LogOut,
  UserCheck,
  ShieldCheck,
} from "lucide-react";

const shadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

export default function TeacherProfilePage() {
  const router = useRouter();
  const { dashboard, isLoading } = useAuthenticatedTeacherProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const profile = dashboard?.profile ?? null;
  const overview = dashboard?.teachingOverview ?? null;

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
      console.error("Teacher sign-out failed:", error);
      setSignOutError("Unable to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32`}
    >
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
            src="/ad_astra_wordmark_2.png"
            alt="AD Astra"
            width={220}
            height={50}
            className="mb-2 h-auto w-auto"
          />

          <h1
            className={`${shadowsIntoLight.className} mt-2 text-[34px] text-black leading-tight`}
          >
            {profile?.displayName ?? "Teacher"}
          </h1>

          <p className="mt-1 text-sm font-medium text-black/60">
            Teacher details and settings
          </p>

          <div className="relative mt-5">
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
              <ProfileAvatar profile={profile} role="Teacher" />
            </div>

            <div className="absolute bottom-1 right-1 rounded-full bg-[#102A43] px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Edit
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <User size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Teacher Information
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {profile?.displayName ?? "Teacher"}</p>
            <p className="break-all"><strong>Teacher ID:</strong> {profile?.teacherProfileId ?? (isLoading ? "Loading..." : "Unavailable")}</p>
            <p><strong>Email:</strong> {profile?.email ?? "Not supplied"}</p>
            <p><strong>School:</strong> {profile?.school ?? "Not supplied"}</p>
            <p>
              <strong>Role:</strong>{" "}
              {profile
                ? profile.isAdministrator
                  ? "Teacher and Administrator"
                  : "Teacher"
                : "Teacher"}
            </p>
            <p>
              <strong>Administrator:</strong>{" "}
              {profile?.isAdministrator ? "Yes" : "No"}
            </p>
            <p>
              <strong>Account status:</strong>{" "}
              {profile?.accountStatus
                ? `${profile.accountStatus.charAt(0).toUpperCase()}${profile.accountStatus.slice(1)}`
                : isLoading
                  ? "Loading..."
                  : "Unavailable"}
            </p>
            <p>
              <strong>Assigned subjects:</strong>{" "}
              {profile?.assignedSubjects.length
                ? profile.assignedSubjects
                    .map((subject) => subject.name)
                    .join(", ")
                : "None"}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <GraduationCap size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Teaching Overview
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Subjects Taught:</strong> {overview?.subjectsTaught ?? 0}</p>
            <p><strong>Active Learners:</strong> {overview?.activeLearners ?? 0}</p>
            <p><strong>Published Lessons:</strong> {overview?.publishedLessons ?? 0}</p>
            <p><strong>Published Activities:</strong> {overview?.publishedActivities ?? 0}</p>
            <p><strong>Submissions Awaiting Review:</strong> {overview?.submissionsAwaitingReview ?? 0}</p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-yellow-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Coins size={22} className="text-[#F59E0B]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              AD Astra Coins
            </h2>
          </div>

          <div className="text-center py-2">
            <p className="text-4xl font-bold text-[#F59E0B]">
              Coming soon
            </p>

            <p className="mt-1 text-sm font-semibold text-black/70">
              Faculty Coins
            </p>
          </div>

          <p className="mt-3 text-sm text-black/70 leading-relaxed">
            Earn coins by creating lessons, uploading readings,
            publishing activities, reviewing learner work and
            contributing course content to the AD Astra system.
          </p>
        </section>

        

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Settings size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Settings
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/50">
              Account
            </p>
            <PasswordResetButton className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 text-left font-semibold disabled:opacity-60" />
            <button
              type="button"
              onClick={() =>
                setSettingsNotice("Subscription plans are not available yet.")
              }
              className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 text-left font-semibold"
            >
              <CreditCard size={18} aria-hidden="true" />
              Subscription Plan
            </button>

            <p className="pt-2 text-xs font-bold uppercase tracking-[0.12em] text-black/50">
              Teaching and Administration
            </p>
            {/* AD ASTRA ADMINISTRATOR HUB -- STAGE 1: only ever rendered
                for an account the server has already confirmed is an
                administrator (profile.isAdministrator, resolved from
                teacher_profiles.is_administrator by
                getAuthenticatedTeacherProfile). Hiding this link is a UX
                convenience only -- /teacher/admin itself independently
                re-checks authorizeAdministrator() server-side regardless
                of whether a teacher ever sees this entry. */}
            {profile?.isAdministrator ? (
              <Link
                href="/teacher/admin"
                className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 font-semibold"
              >
                <ShieldCheck size={18} aria-hidden="true" />
                Administrator
              </Link>
            ) : null}
            <Link
              href="/teacher/profile/learner-approvals"
              className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 font-semibold"
            >
              <UserCheck size={18} aria-hidden="true" />
              Learner Approvals
            </Link>
            <button
              type="button"
              onClick={() =>
                setSettingsNotice(
                  "Subject enrolment management is coming in a later phase.",
                )
              }
              className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 text-left font-semibold"
            >
              <BookOpen size={18} aria-hidden="true" />
              Manage Subject Enrolments
            </button>
            <button
              type="button"
              onClick={() =>
                setSettingsNotice(
                  "Content archiving is coming in the next content phase.",
                )
              }
              className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 text-left font-semibold"
            >
              <Archive size={18} aria-hidden="true" />
              Archived Content
            </button>

            {settingsNotice && (
              <p className="rounded-xl bg-[#EEF7FF] p-3 font-medium text-[#102A43]">
                {settingsNotice}
              </p>
            )}

            <p className="pt-2 text-xs font-bold uppercase tracking-[0.12em] text-black/50">
              Session
            </p>

            <button
              type="button"
              onClick={() => void signOut()}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-xl bg-[#F8FBFF] p-3 text-left font-semibold text-red-600 disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={18} aria-hidden="true" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </button>

            {signOutError && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 font-medium text-red-700"
              >
                {signOutError}
              </p>
            )}
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4 text-[#508DB1]">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}
