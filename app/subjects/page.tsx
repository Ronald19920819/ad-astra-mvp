import Image from "next/image";
import Link from "next/link";
import { BarChart3, BookOpen, Languages, ScrollText } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  type LearnerIdentityResult,
} from "@/lib/supabase/learnerWorkReader";
import {
  getSubjectLearnerOverview,
  type SubjectLearnerOverview,
} from "@/lib/supabase/businessStudiesLearnerOverview";
import { getLearnerSubjectKeysForProfile } from "@/lib/supabase/subjectAccess";
import { logSupabaseError } from "@/lib/supabase/errorDetails";
import { getSubjectCardStatus } from "@/lib/subjects/learnerStatus";
import {
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";

const subjectIcons = {
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  languages: Languages,
  "scroll-text": ScrollText,
} as const;

type SubjectCardData = {
  subjectKey: SubjectKey;
  overview: SubjectLearnerOverview | null;
};

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  let identity: LearnerIdentityResult;
  let currentLearner = null;
  try {
    currentLearner = await getAuthenticatedLearnerProfile();
    if (!currentLearner) {
      identity = {
        status: "error",
        message: "Unable to load learner subjects.",
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
    logSupabaseError("Unable to resolve learner identity for subjects:", error);
    identity = {
      status: "error",
      message: "Unable to load learner subjects.",
      code: "IDENTITY_ERROR",
    };
  }

  let subjectCards: SubjectCardData[] = [];
  if (identity.status === "success" && currentLearner) {
    try {
      const enrolledSubjectKeys = getLearnerSubjectKeysForProfile(
        currentLearner,
      );
      subjectCards = await Promise.all(
        enrolledSubjectKeys.map(async (subjectKey) => {
          const subject = getSubjectConfiguration(subjectKey);
          try {
            return {
              subjectKey,
              overview: await getSubjectLearnerOverview(
                currentLearner.userId,
                subject.databaseId,
              ),
            };
          } catch (error) {
            logSupabaseError(
              `Unable to load ${subject.displayName} subject overview:`,
              error,
            );
            return { subjectKey, overview: null };
          }
        }),
      );
    } catch (error) {
      logSupabaseError("Unable to load learner subject enrolments:", error);
    }
  }

  const learnerName =
    identity.status === "success"
      ? identity.fullName ?? "Name unavailable"
      : "Profile unavailable";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-48">
      <div className="mx-auto max-w-md">
        <div
          className="relative mb-6 h-[190px] overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            backgroundImage: "url('/hero-banner.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-center p-5">
            <div className="mb-3 flex items-center gap-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
              />
              <Image
                src="/ad_astra_wordmark.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                className="h-auto w-[180px]"
              />
            </div>
            <h1 className={`${neueHaas.className} text-xl font-bold text-white`}>
              Subjects
            </h1>
            <p className={`${neueHaas.className} mt-1.5 text-sm font-medium text-[#d0d4dd]`}>
              {learnerName} &bull; Choose a subject
            </p>
          </div>
        </div>

        {identity.status === "error" ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
            {identity.message}
          </p>
        ) : subjectCards.length === 0 ? (
          <p className="rounded-[2rem] border border-blue-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No enrolled subjects are available yet.
          </p>
        ) : (
          <div className="space-y-4">
            {subjectCards.map(({ subjectKey, overview }) => {
              const subject = getSubjectConfiguration(subjectKey);
              const Icon = subjectIcons[subject.iconKey];
              const mark =
                overview?.progress.overallMark === null ||
                overview?.progress.overallMark === undefined
                  ? null
                  : Math.round(overview.progress.overallMark);
              const markDisplay = mark === null ? "—" : `${mark}%`;
              const status = overview
                ? getSubjectCardStatus(overview.nextAction)
                : "Attention Required";

              return (
                <Link
                  key={subject.key}
                  href={subject.routes.learnerDashboard}
                  className="block"
                >
                  <div
                    className="flex items-center gap-4 rounded-[2rem] border bg-white px-4 py-4 shadow-sm"
                    style={{ borderColor: subject.colourTheme.border }}
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] shadow-md"
                      style={{ backgroundColor: subject.colourTheme.primary }}
                    >
                      <Icon size={32} color="white" strokeWidth={2.2} />
                    </div>

                    <div className="min-w-0 flex-1 text-xs text-slate-900">
                      <h2 className="text-lg font-bold leading-tight">
                        {subject.displayName}
                      </h2>
                      <p className="mt-2">
                        <strong>Overall Mark:</strong>{" "}
                        <span
                          className="font-bold"
                          style={{ color: subject.colourTheme.primary }}
                        >
                          {mark === null ? "Not available" : markDisplay}
                        </span>
                      </p>
                      <p className="mt-1">
                        <strong>Current Topic:</strong>{" "}
                        {overview?.currentTopic ?? "No current lesson"}
                      </p>
                      <p className="mt-1">
                        <strong>Status:</strong> {status}
                      </p>
                    </div>

                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background:
                          mark === null
                            ? "#E5E7EB"
                            : `conic-gradient(${subject.colourTheme.primary} ${
                                mark * 3.6
                              }deg, #E5E7EB 0deg)`,
                      }}
                      aria-label={
                        mark === null
                          ? "Overall Mark not available"
                          : `Overall Mark ${markDisplay}`
                      }
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                        <span className="text-sm font-bold text-slate-900">
                          {markDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm font-semibold text-black">
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
