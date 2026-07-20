"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
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

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";
function ActivityCard({ activity }: { activity: LearnerPublishedActivity }) {
  const hasSchedule =
    activity.lesson.term_number !== null &&
    activity.lesson.week_number !== null;

  return (
    <Link
      href={`/business-studies-activities/${activity.id}`}
      data-activity-id={activity.id}
      className="block"
    >
      <div className="rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <SquarePen size={18} className="shrink-0 text-[#F97316]" />
          <p className="text-sm font-bold text-black">{activity.title}</p>
        </div>

        <p className="text-sm text-black/60">
          Lesson {activity.lesson.lesson_number} — {activity.lesson.title}
        </p>

        <p className="mt-2 text-xs font-semibold text-slate-600">
          {hasSchedule && (
            <>
              Term {activity.lesson.term_number} · Week{" "}
              {activity.lesson.week_number} ·{" "}
            </>
          )}
          {activity.total_marks} marks
        </p>

        {activity.due_date && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#F97316]">
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

export default function BusinessStudiesActivities() {
  const [activities, setActivities] = useState<LearnerPublishedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [allActivitiesOpen, setAllActivitiesOpen] = useState(false);
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivities() {
      try {
        setIsLoading(true);
        setLoadError("");
        const publishedActivities = await getLearnerPublishedActivities(
          businessStudiesSubjectId,
        );
        setActivities(publishedActivities);
      } catch (error) {
        console.error("Unable to load learner Business Studies activities:", error);
        setLoadError("Unable to load activities");
      } finally {
        setIsLoading(false);
      }
    }

    loadActivities();
  }, []);

  const scheduledActivities = activities
    .filter(
      (activity) =>
        activity.lesson.term_number !== null &&
        activity.lesson.week_number !== null,
    )
    .sort((activityA, activityB) => {
      if (activityA.lesson.term_number !== activityB.lesson.term_number) {
        return (
          (activityB.lesson.term_number ?? 0) -
          (activityA.lesson.term_number ?? 0)
        );
      }

      if (activityA.lesson.week_number !== activityB.lesson.week_number) {
        return (
          (activityB.lesson.week_number ?? 0) -
          (activityA.lesson.week_number ?? 0)
        );
      }

      return (
        new Date(activityB.created_at).getTime() -
        new Date(activityA.created_at).getTime()
      );
    });
  const newestScheduledActivity = scheduledActivities[0];
  const currentTerm = newestScheduledActivity?.lesson.term_number ?? null;
  const currentWeek = newestScheduledActivity?.lesson.week_number ?? null;
  const currentActivities = scheduledActivities.filter(
    (activity) =>
      activity.lesson.term_number === currentTerm &&
      activity.lesson.week_number === currentWeek,
  );

  const activityGroups = Object.values(
    activities.reduce<
      Record<
        string,
        {
          key: string;
          termNumber: number | null;
          weekNumber: number | null;
          activities: LearnerPublishedActivity[];
        }
      >
    >((groups, activity) => {
      const termNumber = activity.lesson.term_number;
      const weekNumber = activity.lesson.week_number;
      const key =
        termNumber === null || weekNumber === null
          ? "unscheduled"
          : `${termNumber}-${weekNumber}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          termNumber,
          weekNumber,
          activities: [],
        };
      }

      groups[key].activities.push(activity);
      return groups;
    }, {}),
  ).sort((groupA, groupB) => {
    if (groupA.termNumber === null || groupA.weekNumber === null) return 1;
    if (groupB.termNumber === null || groupB.weekNumber === null) return -1;
    if (groupA.termNumber !== groupB.termNumber) {
      return groupB.termNumber - groupA.termNumber;
    }
    return groupB.weekNumber - groupA.weekNumber;
  });

  function toggleAllActivities() {
    if (allActivitiesOpen) setOpenWeekKey(null);
    setAllActivitiesOpen(!allActivitiesOpen);
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="mx-auto max-w-md">
        <div className="mb-6 rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/business-studies-dashboard">
              <ArrowLeft size={22} />
            </Link>

            <Image
              src="/re-petersen.png"
              alt="Teacher Ronald"
              width={48}
              height={48}
              className="rounded-full"
            />

            <div>
              <h1 className="text-lg font-bold">
                Business Studies Activities
              </h1>
              <p className="text-sm text-blue-100">Teacher Ronald</p>
            </div>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF3E6] p-3 text-[#F97316]">
              <SquarePen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Current Activities
              </h2>
              <p className="text-sm text-black/60">
                {currentTerm !== null && currentWeek !== null
                  ? `Term ${currentTerm} · Week ${currentWeek}`
                  : "Complete this week's work"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-black/60">Loading activities...</p>
          ) : loadError ? (
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-black/60">
              No published activities available
            </p>
          ) : currentActivities.length === 0 ? (
            <p className="text-sm text-black/60">
              No activities are linked to a scheduled lesson.
            </p>
          ) : (
            <div className="space-y-4">
              {currentActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
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
                Tap a week to view its activities
              </p>
            </div>

            {allActivitiesOpen ? (
              <ChevronDown size={22} className="text-[#F97316]" />
            ) : (
              <ChevronRight size={22} className="text-[#F97316]" />
            )}
          </button>

          {allActivitiesOpen && (
            <div className="mt-4 space-y-3">
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
                activityGroups.map((group) => {
                  const weekIsOpen = openWeekKey === group.key;
                  const hasSchedule =
                    group.termNumber !== null && group.weekNumber !== null;

                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-2xl border border-orange-100 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenWeekKey((currentKey) =>
                            currentKey === group.key ? null : group.key,
                          )
                        }
                        className="flex w-full items-center justify-between p-4 text-left"
                      >
                        <div>
                          <h3 className="text-sm font-bold text-[#102A43]">
                            {hasSchedule
                              ? `Term ${group.termNumber} · Week ${group.weekNumber}`
                              : "Term and week not set"}
                          </h3>
                          <p className="text-xs text-black/50">
                            {group.activities.length}{" "}
                            {group.activities.length === 1
                              ? "activity"
                              : "activities"}
                          </p>
                        </div>

                        {weekIsOpen ? (
                          <ChevronDown size={20} className="text-[#F97316]" />
                        ) : (
                          <ChevronRight size={20} className="text-[#F97316]" />
                        )}
                      </button>

                      {weekIsOpen && (
                        <div className="space-y-3 border-t border-orange-100 p-3">
                          {group.activities.map((activity) => (
                            <ActivityCard
                              key={activity.id}
                              activity={activity}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
