import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  getSubjectLearningTracker,
  getLearningTrackerErrorDetails,
  type LearningTrackerLesson,
  type TrackerContentState,
  type TrackerOverallStatus,
} from "@/lib/supabase/learningTrackerReader";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

type TrackerWeekGroup = {
  key: string;
  weekNumber: number | null;
  lessons: LearningTrackerLesson[];
};

type TrackerTermGroup = {
  key: string;
  termNumber: number | null;
  weeks: TrackerWeekGroup[];
};

function progressIndicator(value: TrackerContentState, label: string) {
  const display = {
    complete: { symbol: "✓", description: "Complete", className: "text-green-600" },
    partial: { symbol: "!", description: "Started, under 90%", className: "text-amber-500" },
    not_started: { symbol: "✗", description: "Not started", className: "text-red-500" },
    unavailable: { symbol: "—", description: "Not attached", className: "text-slate-400" },
  }[value];

  return (
    <span
      className={`inline-flex min-w-5 justify-center text-lg font-bold ${display.className}`}
      title={`${label}: ${display.description}`}
      aria-label={`${label}: ${display.description}`}
    >
      {display.symbol}
    </span>
  );
}

function statusClasses(status: TrackerOverallStatus) {
  if (status === "Complete") return "bg-green-100 text-green-700";
  if (status === "Needs Support") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatLastActive(timestamp: string | null) {
  if (!timestamp) return "Never";

  const elapsedMilliseconds = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);
  const elapsedHours = Math.floor(elapsedMilliseconds / 3_600_000);
  const elapsedDays = Math.floor(elapsedMilliseconds / 86_400_000);

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  if (elapsedDays === 1) return "Yesterday";
  return `${elapsedDays} days ago`;
}

function buildGroups(lessons: LearningTrackerLesson[]): TrackerTermGroup[] {
  const terms = new Map<string, TrackerTermGroup>();

  for (const lesson of lessons) {
    const termKey = lesson.termNumber === null ? "unscheduled" : String(lesson.termNumber);
    let term = terms.get(termKey);
    if (!term) {
      term = { key: termKey, termNumber: lesson.termNumber, weeks: [] };
      terms.set(termKey, term);
    }

    const weekKey = lesson.weekNumber === null ? "unscheduled" : String(lesson.weekNumber);
    let week = term.weeks.find((candidate) => candidate.key === weekKey);
    if (!week) {
      week = { key: weekKey, weekNumber: lesson.weekNumber, lessons: [] };
      term.weeks.push(week);
    }
    week.lessons.push(lesson);
  }

  return [...terms.values()];
}

function LearnerRows({
  lesson,
  subjectName,
}: {
  lesson: LearningTrackerLesson;
  subjectName: string;
}) {
  if (lesson.learners.length === 0) {
    return (
      <p className="border-t border-orange-100 p-4 text-sm text-slate-500">
        No learner participation has been recorded for {subjectName} yet.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto border-t border-orange-100">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-orange-50 text-slate-700">
          <tr>
            <th className="p-3 text-left">Learner</th>
            <th className="p-3 text-center">Video</th>
            <th className="p-3 text-center">Reading</th>
            <th className="p-3 text-center">Quiz</th>
            <th className="p-3 text-center">Status</th>
            <th className="p-3 text-left">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {lesson.learners.map((learner) => (
            <tr key={learner.learnerProfileId} className="border-t border-orange-100 bg-white">
              <td className="max-w-56 break-words p-3 font-semibold text-slate-900">
                {learner.name}
              </td>
              <td className="p-3 text-center">{progressIndicator(learner.video, "Video")}</td>
              <td className="p-3 text-center">{progressIndicator(learner.reading, "Reading")}</td>
              <td className="p-3 text-center">{progressIndicator(learner.quiz, "Quiz")}</td>
              <td className="p-3 text-center">
                <span className={`mx-auto inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClasses(learner.status)}`}>
                  {learner.status}
                </span>
              </td>
              <td className="whitespace-nowrap p-3 font-medium text-slate-600">
                {formatLastActive(learner.lastActiveAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function TeacherSubjectLearningTrackerPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let lessons: LearningTrackerLesson[] = [];
  let loadError = "";

  try {
    lessons = await getSubjectLearningTracker(subject.databaseId);
  } catch (error) {
    console.error(
      `Unable to load ${subject.displayName} learning tracker:`,
      getLearningTrackerErrorDetails(error),
    );
    loadError = "Unable to load learner participation. Please try again.";
  }

  const termGroups = buildGroups(lessons);

  return (
    <main
      className="subject-theme min-h-screen overflow-x-hidden bg-slate-100 pb-24"
      style={
        {
          "--subject-primary": subject.colourTheme.primary,
          "--subject-soft": subject.colourTheme.softBackground,
          "--subject-border": subject.colourTheme.border,
        } as CSSProperties
      }
    >
      <div className="mx-auto w-full min-w-0 max-w-3xl px-4 pt-4">
        <div
          className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg"
          style={{ height: "240px" }}
        >
          <Image
            src="/hero-banner-2.png"
            alt="Teacher Hero Banner"
            width={1400}
            height={750}
            priority
            className="absolute left-0 top-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
          <div className="relative z-10 flex h-full flex-col p-5 pt-2">
            <div className="mb-3 flex items-center gap-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />
              <Image
                src="/ad_astra_wordmark_2.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{ width: "180px", height: "auto" }}
              />
            </div>
            <div className="mt-auto">
              <Link
                href={buildSubjectRoute(subject, "teacherOverview")}
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-white">Learning Tracker</h1>
              <p className="mt-1 text-sm text-white/90">{subject.displayName}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-orange-50 p-5">
          <h2 className="mb-2 font-bold text-slate-900">Lesson evidence tracker</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Open a lesson to view learner participation across its attached video, reading and quiz.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
            {loadError}
          </p>
        ) : termGroups.length === 0 ? (
          <p className="rounded-[2rem] border border-orange-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
            No published {subject.displayName} lessons available.
          </p>
        ) : (
          <div className="space-y-6">
            {termGroups.map((term) => (
              <section key={term.key} className="min-w-0">
                <h2 className="mb-3 px-2 text-xl font-bold text-slate-900">
                  {term.termNumber === null ? "Term not set" : `Term ${term.termNumber}`}
                </h2>
                <div className="space-y-5">
                  {term.weeks.map((week) => (
                    <section key={week.key} className="min-w-0">
                      <h3 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-orange-600">
                        {week.weekNumber === null ? "Week not set" : `Week ${week.weekNumber}`}
                      </h3>
                      <div className="min-w-0 space-y-4">
                        {week.lessons.map((lesson) => (
                          <details
                            key={lesson.id}
                            className="w-full min-w-0 overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-sm"
                          >
                            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 p-5 text-left">
                              <div className="min-w-0">
                                <h4 className="break-words text-lg font-bold text-slate-900">
                                  Lesson {lesson.lessonNumber} - {lesson.title}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500">
                                  Tap to view learner lesson participation
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-orange-50 p-2 text-orange-500">
                                <ChevronDown size={20} />
                              </span>
                            </summary>
                            <LearnerRows
                              lesson={lesson}
                              subjectName={subject.displayName}
                            />
                          </details>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black">
          <Link href="/teacher"><div className="py-4">Home</div></Link>
          <Link href="/teacher/subjects"><div className="py-4 text-[#508DB1]">Subjects</div></Link>
          <Link href="/teacher/messages"><div className="py-4">Messages</div></Link>
          <Link href="/teacher/reports"><div className="py-4">Reports</div></Link>
          <Link href="/teacher/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
      <style>{`
        .subject-theme .bg-orange-50 {
          background-color: var(--subject-soft) !important;
        }
        .subject-theme .text-orange-500,
        .subject-theme .text-orange-600 {
          color: var(--subject-primary) !important;
        }
        .subject-theme .border-orange-100 {
          border-color: var(--subject-border) !important;
        }
      `}</style>
    </main>
  );
}

export default function BusinessStudiesLearningTrackerPage() {
  return <TeacherSubjectLearningTrackerPage />;
}
