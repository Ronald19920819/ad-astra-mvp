import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  AwaitingCard,
  ReturnedCard,
} from "@/components/learners/WorkSubmissionCards";
import {
  CATCH_UP_MINUTES_PER_LESSON,
  CATCH_UP_MINUTES_PER_MARK,
  calculateCatchUpPlan,
  formatCatchUpDuration,
} from "@/lib/learners/catchUpPlan";
import {
  buildSubjectRoute,
  getSubjectConfigurationByDatabaseId,
} from "@/lib/subjects/subjectConfig";
import { getCurrentLearnerContext } from "@/lib/supabase/currentLearnerContext";
import {
  getLearnerSubjectWorkStatus,
  type OutstandingWorkItem,
} from "@/lib/supabase/learnerSubjectWorkReader";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";

export const dynamic = "force-dynamic";

function firstSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function ErrorShell({ message }: { message: string }) {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6 lg:px-8`}
    >
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:max-w-3xl">
        <Link
          href="/your-work"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
        >
          <ArrowLeft size={17} /> Back to Your Work
        </Link>
        <p className="text-sm font-semibold text-slate-600">{message}</p>
      </div>
    </main>
  );
}

function estimatedMinutesFor(item: OutstandingWorkItem) {
  return item.kind === "lesson"
    ? CATCH_UP_MINUTES_PER_LESSON
    : item.totalMarks * CATCH_UP_MINUTES_PER_MARK;
}

// Styled to match components/home/Next24HoursCard.tsx's Message Board rows
// (circular icon avatar, bold title, small slate subtitle, right-aligned
// label, chevron) rather than a new card style.
function OutstandingRow({ item }: { item: OutstandingWorkItem }) {
  const Icon = item.kind === "lesson" ? BookOpen : ClipboardList;
  const numberLabel = `Lesson ${item.lessonNumber}`;
  const marksLabel = item.kind === "activity" ? `${item.totalMarks} marks` : null;
  const dueLabel = item.dueDate
    ? `${item.isOverdue ? "Overdue" : "Due"} ${formatDateOnly(item.dueDate)}`
    : null;
  const minutesLabel = `${estimatedMinutesFor(item)} min`;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EEF7FF]">
        <Icon size={22} color="#508DB1" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={neueHaas.className}
          style={{ color: "#0f172a", fontSize: "15px", fontWeight: 700 }}
        >
          {item.title}
        </p>
        <p
          className={neueHaas.className}
          style={{ color: "#334155", fontSize: "12px", fontWeight: 500, marginTop: "2px" }}
        >
          {item.kind === "lesson" ? "Lesson" : "Activity"} · {numberLabel}
          {marksLabel ? ` · ${marksLabel}` : ""}
        </p>
        {dueLabel && (
          <p
            className={neueHaas.className}
            style={{
              color: item.isOverdue ? "#dc2626" : "#334155",
              fontSize: "12px",
              fontWeight: 600,
              marginTop: "2px",
            }}
          >
            {dueLabel}
          </p>
        )}
      </div>

      <p
        className={`${neueHaas.className} shrink-0 text-right`}
        style={{ color: "#2563eb", fontSize: "12px", fontWeight: 700 }}
      >
        ~{minutesLabel}
      </p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  accentColour,
}: {
  label: string;
  value: string;
  accentColour: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold" style={{ color: accentColour }}>
        {value}
      </p>
    </div>
  );
}

export default async function SubjectYourWorkPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectId = firstSearchParamValue((await searchParams)?.subject);
  const subject = subjectId
    ? getSubjectConfigurationByDatabaseId(subjectId)
    : undefined;

  if (!subject) {
    return <ErrorShell message="Unknown subject." />;
  }

  let context;
  try {
    context = await getCurrentLearnerContext();
  } catch (error) {
    console.error("Unable to resolve learner context for subject Your Work:", error);
    return <ErrorShell message="Unable to load your work." />;
  }

  if (context.status === "error") {
    return <ErrorShell message={context.message} />;
  }

  const access = verifyLearnerSubjectAccessForProfile(
    context.profile,
    subject.databaseId,
  );
  if (!access.allowed) {
    return (
      <ErrorShell message="You do not have access to this subject's Your Work." />
    );
  }

  let workStatus;
  try {
    workStatus = await getLearnerSubjectWorkStatus(
      context.identity.learnerId,
      subject.databaseId,
    );
  } catch (error) {
    console.error("Unable to load subject work status:", {
      subjectId: subject.databaseId,
      error,
    });
    return <ErrorShell message="Unable to load your work for this subject." />;
  }

  const plan = calculateCatchUpPlan({
    outstandingLessonCount: workStatus.outstandingLessons.length,
    outstandingActivityMarks: workStatus.outstandingActivities.map(
      (activity) => activity.totalMarks,
    ),
  });

  const awaitingActivities = workStatus.completedActivities.filter(
    (submission) => submission.status !== "returned",
  );
  const returnedActivities = workStatus.completedActivities.filter(
    (submission) => submission.status === "returned",
  );
  const hasOutstandingWork = workStatus.outstandingItems.length > 0;
  const hasCompletedWork =
    workStatus.completedActivities.length > 0 ||
    workStatus.completedLessons.length > 0;

  const theme = subject.colourTheme;
  const learnerFirstName = context.profile.firstName?.trim() || "";
  const heading = learnerFirstName
    ? `Your Work, ${learnerFirstName}`
    : "Your Work";

  return (
    <main
      className={`${neueHaas.className} min-h-screen overflow-x-hidden bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6 lg:px-8`}
    >
      <div className="mx-auto flex w-full max-w-md min-w-0 flex-col gap-5 lg:max-w-6xl lg:gap-8">
        <section className="rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg lg:p-6">
          <Link
            href={buildSubjectRoute(subject, "learnerDashboard")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-100"
          >
            <ArrowLeft size={17} /> Back to {subject.displayName}
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: theme.softBackground, color: theme.primary }}
            >
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{heading}</h1>
              <p className="mt-1 text-sm text-blue-100">{subject.displayName}</p>
            </div>
          </div>
        </section>

        {context.identity.isDevelopmentFallback && (
          <p className="mx-auto w-full max-w-md rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 lg:max-w-4xl">
            Development testing mode: showing work for the configured test
            learner.
          </p>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] lg:items-start lg:gap-6">
          <div className="flex flex-col gap-5 lg:gap-6">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: theme.softBackground, color: theme.primary }}
                >
                  <Clock3 size={22} />
                </div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Outstanding Work · {workStatus.outstandingItems.length}
                </h2>
              </div>

              {hasOutstandingWork ? (
                <div className="divide-y divide-blue-50 overflow-hidden rounded-2xl border border-blue-50">
                  {workStatus.outstandingItems.map((item) => (
                    <OutstandingRow key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                  <PartyPopper size={20} className="shrink-0 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-600">
                    You&apos;re all caught up.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: theme.softBackground, color: theme.primary }}
                >
                  <Sparkles size={22} />
                </div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Completed Work
                </h2>
              </div>

              {!hasCompletedWork ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  No completed work yet.
                </p>
              ) : (
                <div className="space-y-6">
                  {workStatus.completedLessons.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Completed Lessons · {workStatus.completedLessons.length}
                      </p>
                      <div className="divide-y divide-blue-50 overflow-hidden rounded-2xl border border-blue-50">
                        {workStatus.completedLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-4 px-4 py-3"
                          >
                            <CheckCircle2
                              size={18}
                              className="shrink-0"
                              style={{ color: theme.primary }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#102A43]">
                                {lesson.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                Lesson {lesson.lessonNumber}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {awaitingActivities.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Awaiting Teacher Review · {awaitingActivities.length}
                      </p>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {awaitingActivities.map((submission) => (
                          <AwaitingCard key={submission.id} submission={submission} />
                        ))}
                      </div>
                    </div>
                  )}

                  {returnedActivities.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Returned Work · {returnedActivities.length}
                      </p>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {returnedActivities.map((submission) => (
                          <ReturnedCard key={submission.id} submission={submission} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <section
            className="mt-5 rounded-[2rem] border p-5 shadow-sm lg:sticky lg:top-6 lg:mt-0 lg:p-6"
            style={{ borderColor: theme.border, backgroundColor: theme.softBackground }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3" style={{ color: theme.primary }}>
                <CalendarCheck2 size={22} />
              </div>
              <h2 className="text-lg font-bold text-[#102A43]">Catch Up Plan</h2>
            </div>

            {plan.totalMinutes === 0 ? (
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm font-semibold text-slate-600">
                  Nothing outstanding right now — nice work staying on top of{" "}
                  {subject.displayName}.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatBlock
                    label="Total time needed"
                    value={formatCatchUpDuration(plan.totalMinutes)}
                    accentColour={theme.primary}
                  />
                  <StatBlock
                    label="Daily commitment"
                    value="1 hour/day"
                    accentColour={theme.primary}
                  />
                  <StatBlock
                    label="Days to catch up"
                    value={String(plan.daysRequired)}
                    accentColour={theme.primary}
                  />
                  <StatBlock
                    label="Outstanding items"
                    value={String(
                      plan.outstandingLessonCount + plan.outstandingActivityCount,
                    )}
                    accentColour={theme.primary}
                  />
                </div>

                {plan.catchUpByDateKey && (
                  <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-[#102A43]">
                    At 1 hour per day, you&apos;ll be caught up by{" "}
                    <span style={{ color: theme.primary }}>
                      {formatDateOnly(plan.catchUpByDateKey)}
                    </span>
                    .
                  </p>
                )}

                {/* Optional encouragement slot -- intentionally left plain
                    (no illustration) per this task's scope. */}
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {plan.outstandingLessonCount} outstanding lesson
                  {plan.outstandingLessonCount === 1 ? "" : "s"} ·{" "}
                  {plan.outstandingActivityCount} outstanding activit
                  {plan.outstandingActivityCount === 1 ? "y" : "ies"}
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
