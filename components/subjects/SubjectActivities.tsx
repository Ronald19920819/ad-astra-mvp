"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  SquarePen,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerPublishedActivities,
  type LearnerPublishedActivity,
} from "@/lib/supabase/activityReader";
import {
  buildSubjectDetailRoute,
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import {
  getLearnerActivityStatusLabel,
  getLearnerIncompleteActivityStatus,
  isLearnerActivitySubmittedStatus,
  type LearnerActivityStatus,
} from "@/lib/activities/learnerActivityStatus";
import PendingNavigationLink from "@/components/navigation/PendingNavigationLink";
import {
  formatSubjectTeacherLabel,
  getSubjectTeacherInitials,
} from "@/lib/subjects/subjectTeacherPresentation";

const LESSON_TITLE_SEPARATOR = "\u2014";
const SCHEDULE_SEPARATOR = "\u00B7";

type WeekGroup = {
  key: string;
  weekNumber: number | null;
  activities: LearnerPublishedActivity[];
};

type TermGroup = {
  key: string;
  termNumber: number | null;
  weeks: WeekGroup[];
};

function percentage(mark: number | null, total: number | null) {
  if (mark === null || total === null || total <= 0) return null;
  return Math.round((mark / total) * 1000) / 10;
}

function resolveCompletedActivityMark(activity: LearnerPublishedActivity) {
  if (activity.submissionStatus === "returned") {
    const total =
      activity.originalTotalMarks ??
      activity.snapshotTotalMarks ??
      activity.total_marks;
    const finalMark = activity.finalMark ?? null;

    if (finalMark !== null && total > 0) {
      return {
        label: "Final mark",
        rawMark: finalMark,
        total,
        percentage: percentage(finalMark, total),
      };
    }

    return null;
  }

  const preliminaryMark = activity.preliminaryMark ?? null;
  const preliminaryTotal = activity.preliminaryTotal ?? null;
  const preliminaryPercentage = activity.preliminaryPercentage ?? null;

  if (preliminaryMark !== null && preliminaryTotal !== null) {
    return {
      label: "Preliminary mark",
      rawMark: preliminaryMark,
      total: preliminaryTotal,
      percentage:
        preliminaryPercentage ??
        percentage(preliminaryMark, preliminaryTotal),
    };
  }

  return null;
}

function ActivityStatusIndicator({
  status,
  subjectColour,
  labelOverride,
}: {
  status: LearnerActivityStatus;
  subjectColour: string;
  labelOverride?: string;
}) {
  const label = labelOverride ?? getLearnerActivityStatusLabel(status);
  const colours =
    status === "submitted" ||
    status === "marking_failed" ||
    status === "awaiting_review" ||
    status === "returned"
      ? "bg-green-100 text-green-700"
      : status === "current"
        ? "bg-[var(--subject-soft)] text-[var(--subject-primary)]"
        : status === "incomplete"
          ? "bg-slate-100 text-slate-500"
          : "bg-red-100 text-red-600";

  return (
    <div
      aria-label={label}
      title={label}
      className="flex max-w-24 shrink-0 flex-col items-center gap-1 text-center"
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full ${colours}`}
      >
        {status === "submitted" ||
        status === "marking_failed" ||
        status === "awaiting_review" ||
        status === "returned" ? (
          <Check size={18} strokeWidth={3} aria-hidden="true" />
        ) : status === "current" ? (
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: subjectColour }}
            aria-hidden="true"
          />
        ) : status === "incomplete" ? (
          <span className="text-lg font-black leading-none" aria-hidden="true">
            -
          </span>
        ) : (
          <span className="text-lg font-black leading-none" aria-hidden="true">
            !
          </span>
        )}
      </span>
      <span className="text-[10px] font-bold leading-tight">{label}</span>
    </div>
  );
}

function ActivityCard({
  activity,
  activityHref,
  subjectColour,
  status,
}: {
  activity: LearnerPublishedActivity;
  activityHref: string;
  subjectColour: string;
  status: LearnerActivityStatus;
}) {
  const scheduleLabel =
    activity.lesson.term_number === null ||
    activity.lesson.week_number === null
      ? "Term or week not set"
      : `Term ${activity.lesson.term_number} ${SCHEDULE_SEPARATOR} Week ${activity.lesson.week_number}`;

  return (
    <PendingNavigationLink
      href={activityHref}
      data-activity-id={activity.id}
      className="block w-full min-w-0"
    >
      {({ isPending }) => (
        <div className="w-full min-w-0 rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] p-4 shadow-sm lg:p-5">
          <div className="flex min-w-0 items-start justify-between gap-3 lg:gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex min-w-0 items-center gap-3">
                <SquarePen
                  size={18}
                  className="shrink-0 text-[var(--subject-primary)]"
                />
                <p className="min-w-0 break-words text-sm font-bold text-black lg:text-base">
                  {activity.title}
                </p>
              </div>
              <p className="break-words text-sm text-black/60">
                Lesson {activity.lesson.lesson_number} {LESSON_TITLE_SEPARATOR} {activity.lesson.title}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {scheduleLabel} {SCHEDULE_SEPARATOR} {activity.total_marks} marks
              </p>
              {isPending && (
                <p
                  className="mt-3 text-xs font-semibold"
                  style={{ color: subjectColour }}
                >
                  Opening activity...
                </p>
              )}
            </div>
            <ActivityStatusIndicator
              status={status}
              subjectColour={subjectColour}
            />
          </div>

          {activity.due_date && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--subject-primary)]">
              <Clock size={14} />
              <p>
                Due{" "}
                {new Date(activity.due_date).toLocaleDateString("en-ZA", {
                  timeZone: "UTC",
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </PendingNavigationLink>
  );
}

function ActivityProgressRow({
  activity,
  activityHref,
  subjectColour,
  pendingLabel,
  metadataLabel,
  status,
}: {
  activity: LearnerPublishedActivity;
  activityHref: string;
  subjectColour: string;
  pendingLabel: string;
  metadataLabel: string;
  status: LearnerActivityStatus;
}) {
  const scheduleLabel =
    activity.lesson.term_number === null ||
    activity.lesson.week_number === null
      ? "Term or week not set"
      : `Term ${activity.lesson.term_number} ${SCHEDULE_SEPARATOR} Week ${activity.lesson.week_number}`;
  const markSummary = resolveCompletedActivityMark(activity);

  return (
    <PendingNavigationLink
      href={activityHref}
      data-activity-id={activity.id}
      className="block w-full min-w-0 rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] px-4 py-3 shadow-sm lg:px-5"
      pendingChildren={
        <div className="flex min-w-0 items-start justify-between gap-3 lg:gap-4">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold text-black">
              {activity.title}
            </p>
            <p className="mt-1 break-words text-xs font-medium text-black/60">
              Lesson {activity.lesson.lesson_number} {LESSON_TITLE_SEPARATOR} {activity.lesson.title}
            </p>
            <p className="mt-1 text-xs font-medium text-black/60">
              {scheduleLabel}
            </p>
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: subjectColour }}
            >
              {pendingLabel}
            </p>
          </div>
          <ActivityStatusIndicator
            status={status}
            subjectColour={subjectColour}
          />
        </div>
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-3 lg:gap-4">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-black">
            {activity.title}
          </p>
          <p className="mt-1 break-words text-xs font-medium text-black/60">
            Lesson {activity.lesson.lesson_number} {LESSON_TITLE_SEPARATOR} {activity.lesson.title}
          </p>
          <p className="mt-1 text-xs font-medium text-black/60">
            {scheduleLabel}
          </p>
          <div className="mt-2 space-y-1">
            <p
              className="text-xs font-semibold"
              style={{ color: subjectColour }}
            >
              {metadataLabel}
            </p>
            {markSummary ? (
              <p className="text-xs font-semibold text-slate-700">
                {markSummary.label}: {markSummary.rawMark}/{markSummary.total}
                {markSummary.percentage !== null
                  ? ` (${markSummary.percentage}%)`
                  : ""}
              </p>
            ) : activity.submissionStatus === "marking_failed" ? (
              <p className="text-xs font-semibold text-slate-700">
                Marking unavailable
              </p>
            ) : activity.submissionStatus ? (
              <p className="text-xs font-semibold text-slate-700">
                {getLearnerActivityStatusLabel(activity.submissionStatus)}
              </p>
            ) : null}
          </div>
        </div>
        <ActivityStatusIndicator
          status={status}
          subjectColour={subjectColour}
        />
      </div>
    </PendingNavigationLink>
  );
}

function compareLatestFirst(
  activityA: LearnerPublishedActivity,
  activityB: LearnerPublishedActivity,
) {
  const createdAtDifference =
    new Date(activityB.created_at).getTime() -
    new Date(activityA.created_at).getTime();

  return createdAtDifference || activityA.id.localeCompare(activityB.id);
}

function compareProgrammeOrder(
  activityA: LearnerPublishedActivity,
  activityB: LearnerPublishedActivity,
) {
  const termA = activityA.lesson.term_number ?? Number.MAX_SAFE_INTEGER;
  const termB = activityB.lesson.term_number ?? Number.MAX_SAFE_INTEGER;
  if (termA !== termB) return termA - termB;

  const weekA = activityA.lesson.week_number ?? Number.MAX_SAFE_INTEGER;
  const weekB = activityB.lesson.week_number ?? Number.MAX_SAFE_INTEGER;
  if (weekA !== weekB) return weekA - weekB;

  const lessonNumberDifference = activityA.lesson.lesson_number.localeCompare(
    activityB.lesson.lesson_number,
    undefined,
    { numeric: true },
  );
  if (lessonNumberDifference !== 0) return lessonNumberDifference;

  const createdAtDifference =
    new Date(activityA.created_at).getTime() -
    new Date(activityB.created_at).getTime();
  if (createdAtDifference !== 0) return createdAtDifference;

  return activityA.id.localeCompare(activityB.id);
}

function groupActivities(
  activities: LearnerPublishedActivity[],
): TermGroup[] {
  const termMap = new Map<
    string,
    {
      termNumber: number | null;
      weeks: Map<string, WeekGroup>;
    }
  >();

  for (const activity of activities) {
    const termNumber = activity.lesson.term_number;
    const weekNumber = activity.lesson.week_number;
    const termKey =
      termNumber === null ? "term-unscheduled" : `term-${termNumber}`;
    const weekKey =
      weekNumber === null
        ? `${termKey}-week-unscheduled`
        : `${termKey}-week-${weekNumber}`;

    if (!termMap.has(termKey)) {
      termMap.set(termKey, {
        termNumber,
        weeks: new Map(),
      });
    }

    const term = termMap.get(termKey)!;
    if (!term.weeks.has(weekKey)) {
      term.weeks.set(weekKey, {
        key: weekKey,
        weekNumber,
        activities: [],
      });
    }
    term.weeks.get(weekKey)!.activities.push(activity);
  }

  return Array.from(termMap.entries())
    .map(([key, term]) => ({
      key,
      termNumber: term.termNumber,
      weeks: Array.from(term.weeks.values())
        .map((week) => ({
          ...week,
          activities: [...week.activities].sort(compareLatestFirst),
        }))
        .sort((weekA, weekB) => {
          if (weekA.weekNumber === null) return 1;
          if (weekB.weekNumber === null) return -1;
          return weekB.weekNumber - weekA.weekNumber;
        }),
    }))
    .sort((termA, termB) => {
      if (termA.termNumber === null) return 1;
      if (termB.termNumber === null) return -1;
      return termB.termNumber - termA.termNumber;
    });
}

function resolveActivityStatus(
  activity: LearnerPublishedActivity,
  isCurrent: boolean,
) {
  return getLearnerIncompleteActivityStatus({
    submissionStatus: activity.submissionStatus,
    dueDate: activity.due_date,
    isCurrent,
  });
}

function getWeekStatus(
  activities: LearnerPublishedActivity[],
  currentActivityId: string | null,
) {
  const statuses = activities.map((activity) =>
    resolveActivityStatus(activity, activity.id === currentActivityId),
  );

  if (statuses.every((status) => isLearnerActivitySubmittedStatus(status))) {
    return "submitted" as const;
  }

  if (statuses.some((status) => status === "not_submitted")) {
    return "not_submitted" as const;
  }

  if (statuses.some((status) => status === "current")) {
    return "current" as const;
  }

  return "incomplete" as const;
}

export function SubjectActivities({
  subjectKey = "business-studies",
  initialActivities,
  initialLoadError,
  initialTeacherNames,
}: {
  subjectKey?: SubjectKey;
  initialActivities?: LearnerPublishedActivity[];
  initialLoadError?: string;
  initialTeacherNames?: string[];
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const hasInitialState =
    initialActivities !== undefined || initialLoadError !== undefined;
  const [activities, setActivities] = useState<LearnerPublishedActivity[]>(
    initialActivities ?? [],
  );
  const [isLoading, setIsLoading] = useState(!hasInitialState);
  const [loadError, setLoadError] = useState(initialLoadError ?? "");
  const [completedActivitiesOpen, setCompletedActivitiesOpen] = useState(false);
  const [allActivitiesOpen, setAllActivitiesOpen] = useState(false);
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(null);
  const teacherLabel = formatSubjectTeacherLabel(initialTeacherNames);
  const teacherInitials = getSubjectTeacherInitials(initialTeacherNames);

  useEffect(() => {
    if (hasInitialState) {
      return;
    }

    let isActive = true;

    async function loadActivities() {
      try {
        setIsLoading(true);
        setLoadError("");
        const publishedActivities = await getLearnerPublishedActivities(
          subject.databaseId,
        );
        if (isActive) setActivities(publishedActivities);
      } catch (error) {
        console.error(
          `Unable to load learner ${subject.displayName} activities:`,
          error,
        );
        if (isActive) setLoadError("Unable to load activities");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadActivities();
    return () => {
      isActive = false;
    };
  }, [hasInitialState, subject.databaseId, subject.displayName]);

  const latestActivity = [...activities].sort(compareLatestFirst)[0];
  const latestActivityId = latestActivity?.id ?? null;
  const activityGroups = groupActivities(activities);

  const toCompleteActivities = [...activities]
    .filter(
      (activity) =>
        activity.submissionStatus === null && activity.id !== latestActivityId,
    )
    .sort(compareProgrammeOrder);

  const completedActivities = [...activities]
    .filter((activity) => activity.submissionStatus !== null)
    .sort(compareProgrammeOrder);

  const currentActivityIsIncomplete = Boolean(
    latestActivity && latestActivity.submissionStatus === null,
  );

  function toggleAllActivities() {
    if (allActivitiesOpen) setOpenWeekKey(null);
    setAllActivitiesOpen((isOpen) => !isOpen);
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12 lg:px-8`}
      style={
        {
          "--subject-primary": subject.colourTheme.primary,
          "--subject-soft": subject.colourTheme.softBackground,
          "--subject-border": subject.colourTheme.border,
          "--subject-card": `${subject.colourTheme.softBackground}55`,
        } as CSSProperties
      }
    >
      <div className="mx-auto w-full min-w-0 max-w-md lg:max-w-6xl">
        <div className="mb-6 rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg lg:mb-8 lg:p-6">
          <div className="flex items-center gap-4">
            <Link href={buildSubjectRoute(subject, "learnerDashboard")}>
              <ArrowLeft size={22} />
            </Link>
            <div
              role="img"
              aria-label="Assigned teacher profile"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 font-bold"
            >
              {teacherInitials}
            </div>
            <div>
              <h1 className="text-lg font-bold lg:text-xl">
                {subject.displayName} Activities
              </h1>
              <p className="break-words text-sm text-blue-100">{teacherLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:gap-8">
          <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
                <SquarePen size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Current Activity
                </h2>
                <p className="text-sm text-black/60">Most recently published</p>
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-black/60">Loading activities...</p>
            ) : loadError ? (
              <p className="text-sm font-semibold text-red-600">{loadError}</p>
            ) : !latestActivity ? (
              <p className="text-sm text-black/60">
                No published activities available
              </p>
            ) : (
              <div className="lg:max-w-3xl">
                <ActivityCard
                  activity={latestActivity}
                  activityHref={buildSubjectDetailRoute(
                    subject,
                    "learnerActivities",
                    latestActivity.id,
                  )}
                  subjectColour={subject.colourTheme.primary}
                  status={resolveActivityStatus(latestActivity, true)}
                />
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-[#102A43]">
                Your Progress
              </h2>
              <p className="text-sm text-black/60">
                Keep track of outstanding and completed activity work.
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-[#102A43]">
                  To Complete {SCHEDULE_SEPARATOR} {toCompleteActivities.length}
                </h3>
              </div>

              {toCompleteActivities.length > 0 ? (
                <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                  {toCompleteActivities.map((activity) => (
                    <ActivityProgressRow
                      key={activity.id}
                      activity={activity}
                      activityHref={buildSubjectDetailRoute(
                        subject,
                        "learnerActivities",
                        activity.id,
                      )}
                      subjectColour={subject.colourTheme.primary}
                      pendingLabel="Opening activity..."
                      metadataLabel="Outstanding activity"
                      status={resolveActivityStatus(activity, false)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] px-4 py-4 text-sm font-semibold text-slate-600 shadow-sm">
                  {currentActivityIsIncomplete
                    ? "No outstanding catch-up work."
                    : "You're all caught up!"}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-[var(--subject-border)] pt-5">
              <button
                type="button"
                onClick={() => setCompletedActivitiesOpen((isOpen) => !isOpen)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={completedActivitiesOpen}
              >
                <div>
                  <h3 className="text-base font-bold text-[#102A43]">
                    Completed {SCHEDULE_SEPARATOR} {completedActivities.length}
                  </h3>
                  <p className="text-sm text-black/60">
                    Review submitted and completed activities.
                  </p>
                </div>
                {completedActivitiesOpen ? (
                  <ChevronDown
                    size={20}
                    className="text-[var(--subject-primary)]"
                  />
                ) : (
                  <ChevronRight
                    size={20}
                    className="text-[var(--subject-primary)]"
                  />
                )}
              </button>

              {completedActivitiesOpen && (
                <div className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                  {completedActivities.length > 0 ? (
                    completedActivities.map((activity) => (
                      <ActivityProgressRow
                        key={activity.id}
                        activity={activity}
                        activityHref={buildSubjectDetailRoute(
                          subject,
                          "learnerActivities",
                          activity.id,
                        )}
                        subjectColour={subject.colourTheme.primary}
                        pendingLabel="Opening completed activity..."
                        metadataLabel="Completed activity"
                        status={resolveActivityStatus(activity, false)}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] px-4 py-4 text-sm font-semibold text-slate-600 shadow-sm">
                      No completed activities yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-6">
            <button
              type="button"
              onClick={toggleAllActivities}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  All Activities
                </h2>
                <p className="text-sm text-black/60">
                  Browse activities by term and week
                </p>
              </div>
              {allActivitiesOpen ? (
                <ChevronDown
                  size={22}
                  className="text-[var(--subject-primary)]"
                />
              ) : (
                <ChevronRight
                  size={22}
                  className="text-[var(--subject-primary)]"
                />
              )}
            </button>

            {allActivitiesOpen && (
              <div className="mt-5 space-y-6 lg:mt-6 lg:space-y-7">
                {isLoading ? (
                  <p className="text-sm text-black/60">Loading activities...</p>
                ) : loadError ? (
                  <p className="text-sm font-semibold text-red-600">
                    {loadError}
                  </p>
                ) : activityGroups.length === 0 ? (
                  <p className="text-sm text-black/60">
                    No published activities available
                  </p>
                ) : (
                  activityGroups.map((term) => (
                    <div key={term.key} className="min-w-0">
                      <h3 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-[#102A43] lg:mb-4">
                        {term.termNumber === null
                          ? "Term not set"
                          : `Term ${term.termNumber}`}
                      </h3>
                      <div className="space-y-4 lg:space-y-5">
                        {term.weeks.map((week) => {
                          const weekIsOpen = openWeekKey === week.key;
                          const weekStatus = getWeekStatus(week.activities, latestActivityId);

                          return (
                            <div
                              key={week.key}
                              className="overflow-hidden rounded-2xl border border-[var(--subject-border)] bg-white"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenWeekKey((currentKey) =>
                                    currentKey === week.key ? null : week.key,
                                  )
                                }
                                className="flex w-full items-center justify-between gap-3 bg-[var(--subject-card)] p-4 text-left lg:p-5"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-[#102A43]">
                                    {week.weekNumber === null
                                      ? "Week not set"
                                      : `Week ${week.weekNumber}`}
                                  </p>
                                  <p className="mt-1 text-sm text-black/60">
                                    {week.activities.length}{" "}
                                    {week.activities.length === 1
                                      ? "activity"
                                      : "activities"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <ActivityStatusIndicator
                                    status={weekStatus}
                                    subjectColour={subject.colourTheme.primary}
                                    labelOverride={
                                      weekStatus === "submitted"
                                        ? "Completed"
                                        : undefined
                                    }
                                  />
                                  {weekIsOpen ? (
                                    <ChevronDown
                                      size={20}
                                      className="text-[var(--subject-primary)]"
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={20}
                                      className="text-[var(--subject-primary)]"
                                    />
                                  )}
                                </div>
                              </button>
                              {weekIsOpen && (
                                <div className="w-full min-w-0 border-t border-[var(--subject-border)] p-3 lg:p-5">
                                  <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                                    {week.activities.map((activity) => (
                                      <ActivityCard
                                        key={activity.id}
                                        activity={activity}
                                        activityHref={buildSubjectDetailRoute(
                                          subject,
                                          "learnerActivities",
                                          activity.id,
                                        )}
                                        subjectColour={subject.colourTheme.primary}
                                        status={resolveActivityStatus(
                                          activity,
                                          activity.id === latestActivityId,
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function BusinessStudiesActivities() {
  return <SubjectActivities />;
}


