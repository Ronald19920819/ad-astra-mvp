import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { neueHaas } from "@/app/fonts";
import {
  type LearnerIdentityResult,
} from "@/lib/supabase/learnerWorkReader";
import {
  getSubjectLearnerOverview,
  type BusinessStudiesLearnerOverview,
} from "@/lib/supabase/businessStudiesLearnerOverview";
import {
  getLearnerSubjectEvents,
  type SubjectEventSummary,
} from "@/lib/supabase/subjectCommunications";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Languages,
  PlayCircle,
  FileText,
  ScrollText,
  SquarePen,
} from "lucide-react";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { SubjectImportantDatesCard } from "@/components/subjects/SubjectImportantDatesCard";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

export const dynamic = "force-dynamic";

const subjectIcons = {
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  languages: Languages,
  "scroll-text": ScrollText,
} as const;

export async function SubjectDashboard({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const SubjectIcon = subjectIcons[subject.iconKey];
  let identity: LearnerIdentityResult;
  let currentLearner = null;
  try {
    currentLearner = await getAuthenticatedLearnerProfile();
    if (!currentLearner) {
      identity = {
        status: "error",
        message: `Unable to load your ${subject.displayName} progress.`,
        code: "IDENTITY_ERROR",
      };
    } else {
      identity = {
        status: "success",
        learnerId: currentLearner.userId,
        fullName: currentLearner.fullName,
        isDevelopmentFallback: false,
      };
    }
  } catch (error) {
    console.error(`Unable to resolve the ${subject.displayName} learner:`, error);
    identity = {
      status: "error",
      message: `Unable to load your ${subject.displayName} progress.`,
      code: "IDENTITY_ERROR",
    };
  }
  let overview: BusinessStudiesLearnerOverview | null = null;
  let events: SubjectEventSummary[] = [];
  let loadError = "";

  if (identity.status === "success" && currentLearner) {
    try {
      const access = verifyLearnerSubjectAccessForProfile(
        currentLearner,
        subject.databaseId,
      );
      if (!access.allowed) {
        throw new Error("Learner subject enrolment is required.");
      }
      overview = await getSubjectLearnerOverview(
        currentLearner.userId,
        subject.databaseId,
      );
    } catch (error) {
      logSupabaseError(
        `Unable to load ${subject.displayName} learner overview:`,
        error,
      );
      loadError = `Unable to load your ${subject.displayName} progress.`;
    }

    try {
      events = await getLearnerSubjectEvents(currentLearner, subject.databaseId);
    } catch (error) {
      logSupabaseError(
        `Unable to load ${subject.displayName} learner events:`,
        error,
      );
    }
  }
  const learnerName =
    identity.status === "success"
      ? identity.fullName ?? "Learner"
      : "Learner";
  const overallMarkPercentage =
    overview?.progress.overallMark === null ||
    overview?.progress.overallMark === undefined
      ? null
      : Math.round(overview.progress.overallMark);
  const overallMarkDisplay =
    overallMarkPercentage === null ? "N/A" : `${overallMarkPercentage}%`;

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}
      style={
        {
          "--subject-primary": subject.colourTheme.primary,
          "--subject-soft": subject.colourTheme.softBackground,
          "--subject-border": subject.colourTheme.border,
        } as CSSProperties
      }
    >
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "190px",
            backgroundImage: "url('/hero-banner.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <h1
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {subject.displayName}
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {learnerName} • Subject Dashboard
            </p>
          </div>
        </div>

        <SubjectImportantDatesCard events={events} />

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
            <SubjectIcon size={22} />
          </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learning Overview
              </h2>
              <p className="text-xs font-medium text-black/50">
                Current {subject.displayName} progress
              </p>
            </div>
          </div>

          {identity.status === "error" || loadError || !overview ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              {identity.status === "error" ? identity.message : loadError}
            </p>
          ) : (
            <div className="flex flex-col gap-5 text-sm text-black sm:flex-row sm:items-center">
              <div className="flex shrink-0 flex-col items-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${subject.colourTheme.primary} ${
                      (overallMarkPercentage ?? 0) * 3.6
                    }deg, #E5E7EB 0deg)`,
                  }}
                  aria-label={
                    overallMarkPercentage === null
                      ? "Overall Mark not available"
                      : `Overall Mark ${overallMarkDisplay}`
                  }
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white font-bold text-[#102A43]">
                    {overallMarkDisplay}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <p>
                  <span className="font-bold">Overall Mark:</span>{" "}
                  {overallMarkDisplay}
                </p>
                <p>
                  <span className="font-bold">Current Topic:</span>{" "}
                  {overview.currentTopic ?? "No current lesson"}
                </p>
                <p>
                  <span className="font-bold">Next Action:</span>{" "}
                  {overview.nextAction}
                </p>
                <p>
                  <span className="font-bold">Next Test:</span>{" "}
                  {overview.nextTest ?? "No test scheduled"}
                </p>
                <p>
                  <span className="font-bold">Lessons Completed:</span>{" "}
                  {overview.progress.completedLessonCount} of{" "}
                  {overview.progress.totalPublishedLessonCount}
                </p>
                <p>
                  <span className="font-bold">Activities Completed:</span>{" "}
                  {overview.activityCompletion.completedActivityCount} of{" "}
                  {overview.activityCompletion.totalPublishedActivityCount}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
           <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
           <GraduationCap size={22} />
          </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Classroom
              </h2>
              <p className="text-xs font-medium text-black/50">
                Lessons, videos and readings
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
            Find lesson videos, readings and coursework linked to each activity.
          </p>

          <Link href={buildSubjectRoute(subject, "learnerClassroom")}>
            <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3">
              <div className="flex items-center gap-3">
               <BookOpen size={18} className="text-[var(--subject-primary)]" />
                <p className="text-sm font-semibold text-black">
                  Open Classroom
                </p>
              </div>

              <PlayCircle size={18} className="text-[var(--subject-primary)]" />
            </div>
          </Link>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
            <SquarePen size={22} />
          </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Activities
              </h2>
              <p className="text-xs font-medium text-black/50">
                Complete and submit your work
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
  Complete activities, submit your work and keep track of upcoming tasks.
</p>

<Link href={buildSubjectRoute(subject, "learnerActivities")}>
  <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3">
    <div className="flex items-center gap-3">
      <SquarePen size={18} className="text-[var(--subject-primary)]" />
      <p className="text-sm font-semibold text-black">
        Open Activities
      </p>
    </div>

    <FileText size={18} className="text-[var(--subject-primary)]" />
  </div>
</Link>
        </section>
        <Link href="/your-work">
  <section className="mt-5 rounded-[1.5rem] border border-blue-100 bg-white/90 p-4 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
          <FileText size={20} />
        </div>

        <div>
          <h2 className="text-base font-bold text-[#102A43]">
            Your Work
          </h2>
          <p className="text-xs font-medium text-black/50">
            View submitted activities and marks
          </p>
        </div>
      </div>

      <span className="text-lg font-bold text-[var(--subject-primary)]">
        →
      </span>
    </div>
  </section>
</Link>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/home">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/subjects">
            <div className="py-4 text-[#508DB1]">Subjects</div>
          </Link>

          <Link href="/chat">
            <div className="py-4">Chat</div>
          </Link>

          <Link href="/schedule">
            <div className="py-4">Schedule</div>
          </Link>

          <Link href="/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}

export default function BusinessStudiesDashboard() {
  return <SubjectDashboard />;
}
