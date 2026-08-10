import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  Clock,
  Eye,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  getSubjectLearningTracker,
  type TrackerLessonStatus,
} from "@/lib/supabase/learningTrackerReader";
import { getLearnerSupportStatus } from "@/lib/teachers/learnerSupport";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

function formatLastActive(value: Date | null) {
  if (!value) return "Never";
  return value.toLocaleDateString("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  });
}

export async function TeacherSubjectLearnersPage({
  subjectKey,
}: {
  subjectKey: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let loadError = "";
  let lessons: Awaited<ReturnType<typeof getSubjectLearningTracker>> = [];

  try {
    lessons = await getSubjectLearningTracker(subject.databaseId);
  } catch (error) {
    console.error(`Unable to load ${subject.displayName} learners:`, error);
    loadError = "Unable to load learner progress. Please try again.";
  }

  const learnerMap = new Map<
    string,
    {
      id: string;
      name: string;
      statuses: TrackerLessonStatus[];
      completeLessons: number;
      overdueItems: number;
      lastActiveValues: Array<string | null>;
    }
  >();

  for (const lesson of lessons) {
    for (const learner of lesson.learners) {
      const current = learnerMap.get(learner.learnerProfileId) ?? {
        id: learner.learnerProfileId,
        name: learner.name,
        statuses: [],
        completeLessons: 0,
        overdueItems: 0,
        lastActiveValues: [],
      };
      current.statuses.push(learner.status);
      if (learner.status === "Complete") current.completeLessons += 1;
      current.overdueItems += learner.overdueItemCount;
      current.lastActiveValues.push(learner.lastActiveAt);
      learnerMap.set(learner.learnerProfileId, current);
    }
  }

  const learners = [...learnerMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <div
          className="mb-5 rounded-[2rem] border bg-white p-5 shadow-sm"
          style={{ borderColor: subject.colourTheme.border }}
        >
          <Link
            href={buildSubjectRoute(subject, "teacherOverview")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: subject.colourTheme.primary }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Learners</h1>
          <p className="mt-1 text-sm text-slate-500">
            {subject.displayName} Faculty
          </p>
        </div>

        <div
          className="mb-5 rounded-[2rem] border p-5"
          style={{
            borderColor: subject.colourTheme.border,
            backgroundColor: subject.colourTheme.softBackground,
          }}
        >
          <h2 className="mb-2 font-bold text-slate-900">
            Learner subject overview
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            View real lesson engagement and overdue support needs for this
            subject.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
            {loadError}
          </p>
        ) : learners.length === 0 ? (
          <p
            className="rounded-[2rem] border bg-white p-5 text-sm text-slate-500 shadow-sm"
            style={{ borderColor: subject.colourTheme.border }}
          >
            No learner participation has been recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {learners.map((learner) => {
              const supportStatus = getLearnerSupportStatus(learner.overdueItems);
              return (
                <div
                  key={learner.id}
                  className="rounded-[2rem] border bg-white p-5 shadow-sm"
                  style={{ borderColor: subject.colourTheme.border }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="rounded-2xl p-3"
                        style={{
                          backgroundColor: subject.colourTheme.softBackground,
                          color: subject.colourTheme.primary,
                        }}
                      >
                        <UserRound size={22} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words font-bold text-slate-900">
                          {learner.name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {subject.displayName} learner
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        supportStatus === "On Track"
                          ? "bg-green-100 text-green-700"
                          : supportStatus === "Needs Support"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {supportStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                        <BookOpenCheck size={16} /> Completed
                      </div>
                      <p
                        className="text-lg font-bold"
                        style={{ color: subject.colourTheme.primary }}
                      >
                        {learner.completeLessons} of {lessons.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                        <TriangleAlert size={16} /> Missed Items
                      </div>
                      <p
                        className="text-lg font-bold"
                        style={{ color: subject.colourTheme.primary }}
                      >
                        {learner.overdueItems}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
                      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                        <Clock size={16} /> Last Active
                      </div>
                      <p
                        className="font-bold"
                        style={{ color: subject.colourTheme.primary }}
                      >
                        {formatLastActive(
                          latestTimestamp(learner.lastActiveValues),
                        )}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={buildSubjectRoute(subject, "teacherTracker")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: subject.colourTheme.primary }}
                  >
                    <Eye size={17} />
                    View Learning Tracker
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

