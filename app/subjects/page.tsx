import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Languages,
  ScrollText,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { getAuthenticatedLearnerSubjectCards } from "@/lib/supabase/learnerSubjects";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import PendingNavigationLink from "@/components/navigation/PendingNavigationLink";

const subjectIcons = {
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  languages: Languages,
  "scroll-text": ScrollText,
} as const;

type SubjectCardData = {
  subjectKey: SubjectKey;
  approvedStatusLabel: "Active";
  currentTopic: string | null;
};

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  let learnerName = "Profile unavailable";
  let subjectCards: SubjectCardData[] = [];
  let hasLearnerProfile = false;
  let loadError = "";

  try {
    const result = await getAuthenticatedLearnerSubjectCards();
    hasLearnerProfile = Boolean(result.profile);
    learnerName = result.profile?.fullName ?? "Name unavailable";
    subjectCards = result.subjectCards;
  } catch (error) {
    console.error("Unable to resolve learner identity for subjects:", error);
    loadError = "Unable to load learner subjects.";
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 pb-48 lg:px-8">
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <div
          className="relative mb-6 h-[190px] overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg lg:h-[230px]"
          style={{
            backgroundImage: "url('/hero-banner.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-center p-5 lg:p-7">
            <Link
              href="/home"
              className={`${neueHaas.className} mb-4 inline-flex items-center gap-2 self-start text-sm font-semibold text-white`}
            >
              <ArrowLeft size={16} />
              Back to Home
            </Link>
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
                className="h-auto w-[180px] lg:w-[210px]"
              />
            </div>
            <h1 className={`${neueHaas.className} text-xl font-bold text-white lg:text-2xl`}>
              Subjects
            </h1>
            <p
              className={`${neueHaas.className} mt-1.5 text-sm font-medium text-[#d0d4dd] lg:text-base`}
            >
              {learnerName} &bull; Choose a subject
            </p>
          </div>
        </div>

        {!hasLearnerProfile ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
            {loadError || "Unable to load learner subjects."}
          </p>
        ) : subjectCards.length === 0 ? (
          <p className="rounded-[2rem] border border-blue-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No enrolled subjects are available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
            {subjectCards.map(({ subjectKey, approvedStatusLabel, currentTopic }) => {
              const subject = getSubjectConfiguration(subjectKey);
              const Icon = subjectIcons[subject.iconKey];

              return (
                <PendingNavigationLink
                  key={subject.key}
                  href={buildSubjectRoute(subject, "learnerDashboard")}
                  className="block h-full"
                  pendingChildren={
                    <div
                      className="flex h-full items-center gap-4 rounded-[2rem] border bg-white px-4 py-4 shadow-sm lg:px-5 lg:py-5"
                      style={{ borderColor: subject.colourTheme.border }}
                    >
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] shadow-md"
                        style={{ backgroundColor: subject.colourTheme.primary }}
                      >
                        <Icon size={32} color="white" strokeWidth={2.2} />
                      </div>

                      <div className="min-w-0 flex-1 text-xs text-slate-900">
                        <h2 className="text-lg font-bold leading-tight lg:text-xl">
                          {subject.displayName}
                        </h2>
                        <p className="mt-2">
                          <strong>Overall Mark:</strong>{" "}
                          <span
                            className="font-bold"
                            style={{ color: subject.colourTheme.primary }}
                          >
                            Not available
                          </span>
                        </p>
                        <p className="mt-1">
                          <strong>Current Topic:</strong>{" "}
                          {currentTopic ?? "No lesson published yet"}
                        </p>
                        <p className="mt-1">
                          <strong>Status:</strong> {approvedStatusLabel}
                        </p>
                      </div>

                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: "#E5E7EB",
                        }}
                        aria-label="Overall Mark not available"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                          <span className="text-sm font-bold text-slate-900">
                            N/A
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div
                    className="flex h-full items-center gap-4 rounded-[2rem] border bg-white px-4 py-4 shadow-sm lg:px-5 lg:py-5"
                    style={{ borderColor: subject.colourTheme.border }}
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] shadow-md"
                      style={{ backgroundColor: subject.colourTheme.primary }}
                    >
                      <Icon size={32} color="white" strokeWidth={2.2} />
                    </div>

                    <div className="min-w-0 flex-1 text-xs text-slate-900">
                      <h2 className="text-lg font-bold leading-tight lg:text-xl">
                        {subject.displayName}
                      </h2>
                      <p className="mt-2">
                        <strong>Overall Mark:</strong>{" "}
                        <span
                          className="font-bold"
                          style={{ color: subject.colourTheme.primary }}
                        >
                          Not available
                        </span>
                      </p>
                      <p className="mt-1">
                        <strong>Current Topic:</strong>{" "}
                        {currentTopic ?? "No lesson published yet"}
                      </p>
                      <p className="mt-1">
                        <strong>Status:</strong> {approvedStatusLabel}
                      </p>
                    </div>

                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "#E5E7EB",
                      }}
                      aria-label="Overall Mark not available"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                        <span className="text-sm font-bold text-slate-900">
                          N/A
                        </span>
                      </div>
                    </div>
                  </div>
                </PendingNavigationLink>
              );
            })}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm font-semibold text-black lg:max-w-6xl">
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
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}