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
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import {
  getLearnerActivityStatus,
  getLearnerActivityStatusLabel,
  getLearnerActivityStatusTone,
  isLearnerActivitySubmittedStatus,
  type LearnerActivityStatus,
} from "@/lib/activities/learnerActivityStatus";

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

function ActivityStatusIndicator({
  status,
  subjectColour,
  labelOverride,
}: {
  status: LearnerActivityStatus;
  subjectColour: string;
  labelOverride?: string;
}) {
  const tone = getLearnerActivityStatusTone(status);
  const label = labelOverride ?? getLearnerActivityStatusLabel(status);
  const colours =
    tone === "submitted"
      ? "bg-green-100 text-green-700"
      : tone === "current"
        ? "bg-[var(--subject-soft)] text-[var(--subject-primary)]"
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
        {tone === "submitted" ? (
          <Check size={18} strokeWidth={3} aria-hidden="true" />
        ) : tone === "current" ? (
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: subjectColour }}
            aria-hidden="true"
          />
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
  activitiesHref,
  subjectColour,
}: {
  activity: LearnerPublishedActivity;
  activitiesHref: string;
  subjectColour: string;
}) {
  const scheduleLabel =
    activity.lesson.term_number === null ||
    activity.lesson.week_number === null
      ? "Term or week not set"
      : `Term ${activity.lesson.term_number} · Week ${activity.lesson.week_number}`;
  const activityStatus = getLearnerActivityStatus({
    submissionStatus: activity.submissionStatus,
    dueDate: activity.due_date,
  });

  return (
    <Link
      href={`${activitiesHref}/${activity.id}`}
      data-activity-id={activity.id}
      className="block w-full min-w-0"
    >
      <div className="w-full min-w-0 rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] p-4 shadow-sm">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-3">
              <SquarePen
                size={18}
                className="shrink-0 text-[var(--subject-primary)]"
              />
              <p className="min-w-0 break-words text-sm font-bold text-black">
                {activity.title}
              </p>
            </div>
            <p className="break-words text-sm text-black/60">
              Lesson {activity.lesson.lesson_number} — {activity.lesson.title}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {scheduleLabel} · {activity.total_marks} marks
            </p>
          </div>
          <ActivityStatusIndicator
            status={activityStatus}
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
    </Link>
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

function getWeekStatus(activities: LearnerPublishedActivity[]) {
  const statuses = activities.map((activity) =>
    getLearnerActivityStatus({
      submissionStatus: activity.submissionStatus,
      dueDate: activity.due_date,
    }),
  );

  if (statuses.every((status) => isLearnerActivitySubmittedStatus(status))) {
    return "submitted" as const;
  }

  if (statuses.some((status) => status === "current")) {
    return "current" as const;
  }

  return "not_submitted" as const;
}

export function SubjectActivities({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const [activities, setActivities] = useState<LearnerPublishedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [allActivitiesOpen, setAllActivitiesOpen] = useState(false);
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(null);

  useEffect(() => {
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
  }, [subject.databaseId, subject.displayName]);

  const latestActivity = [...activities].sort(compareLatestFirst)[0];
  const activityGroups = groupActivities(activities);

  function toggleAllActivities() {
    if (allActivitiesOpen) setOpenWeekKey(null);
    setAllActivitiesOpen((isOpen) => !isOpen);
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
      style={
        {
          "--subject-primary": subject.colourTheme.primary,
          "--subject-soft": subject.colourTheme.softBackground,
          "--subject-border": subject.colourTheme.border,
          "--subject-card": `${subject.colourTheme.softBackground}55`,
        } as CSSProperties
      }
    >
      <div className="mx-auto w-full min-w-0 max-w-md">
        <div className="mb-6 rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <Link href={subject.routes.learnerDashboard}>
              <ArrowLeft size={22} />
            </Link>
            <div
              role="img"
              aria-label="Teacher profile"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 font-bold"
            >
              T
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {subject.displayName} Activities
              </h1>
              <p className="text-sm text-blue-100">Teacher</p>
            </div>
          </div>
        </div>

        <section className="mb-5 w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm">
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
            <ActivityCard
              activity={latestActivity}
              activitiesHref={subject.routes.learnerActivities}
              subjectColour={subject.colourTheme.primary}
            />
          )}
        </section>

        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm">
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
            <div className="mt-5 space-y-5">
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
                    <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-[#102A43]">
                      {term.termNumber === null
                        ? "Term not set"
                        : `Term ${term.termNumber}`}
                    </h3>
                    <div className="space-y-3">
                      {term.weeks.map((week) => {
                        const weekIsOpen = openWeekKey === week.key;
                        const weekStatus = getWeekStatus(week.activities);

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
                              className="flex w-full items-center justify-between gap-3 bg-[var(--subject-card)] p-4 text-left"
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
                              <div className="w-full min-w-0 space-y-3 border-t border-[var(--subject-border)] p-3">
                                {week.activities.map((activity) => (
                                  <ActivityCard
                                    key={activity.id}
                                    activity={activity}
                                    activitiesHref={
                                      subject.routes.learnerActivities
                                    }
                                    subjectColour={subject.colourTheme.primary}
                                  />
                                ))}
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
    </main>
  );
}

export default function BusinessStudiesActivities() {
  return <SubjectActivities />;
}
