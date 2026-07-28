"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerPublishedLessonsWithCompletion,
  type LearnerPublishedLesson,
} from "@/lib/supabase/lessonReader";
import {
  getLessonLifecycle,
  type LessonLifecycleStatus,
} from "@/lib/lessons/lessonLifecycle";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

type WeekGroup = {
  key: string;
  weekNumber: number | null;
  lessons: LearnerPublishedLesson[];
};

type TermGroup = {
  key: string;
  termNumber: number | null;
  weeks: WeekGroup[];
};

function compareLatestFirst(
  lessonA: LearnerPublishedLesson,
  lessonB: LearnerPublishedLesson,
) {
  const createdAtDifference =
    new Date(lessonB.created_at).getTime() -
    new Date(lessonA.created_at).getTime();

  if (createdAtDifference !== 0) return createdAtDifference;

  const lessonNumberDifference = lessonB.lesson_number.localeCompare(
    lessonA.lesson_number,
    undefined,
    { numeric: true },
  );

  return lessonNumberDifference || lessonA.id.localeCompare(lessonB.id);
}

function LessonLifecycleIndicator({
  status,
  subjectColour,
}: {
  status: LessonLifecycleStatus;
  subjectColour: string;
}) {
  const label =
    status === "completed"
      ? "Completed"
      : status === "current"
        ? "Current"
        : "Attention Required";
  const colours =
    status === "completed"
      ? "bg-green-100 text-green-700"
      : status === "current"
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
        {status === "completed" ? (
          <Check size={18} strokeWidth={3} aria-hidden="true" />
        ) : status === "current" ? (
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

function LessonCard({
  lesson,
  lifecycleStatus,
  classroomHref,
  subjectColour,
}: {
  lesson: LearnerPublishedLesson;
  lifecycleStatus: LessonLifecycleStatus;
  classroomHref: string;
  subjectColour: string;
}) {
  const scheduleLabel =
    lesson.term_number === null || lesson.week_number === null
      ? "Term or week not set"
      : `Term ${lesson.term_number} · Week ${lesson.week_number}`;

  return (
    <Link
      href={`${classroomHref}/${lesson.id}`}
      className="block w-full min-w-0 rounded-2xl border border-[var(--subject-border)] bg-[var(--subject-card)] p-4 shadow-sm"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-black">
            Lesson {lesson.lesson_number} — {lesson.title}
          </p>
          <p className="mt-2 text-sm text-black/60">{scheduleLabel}</p>
          <p
            className="mt-3 text-xs font-semibold"
            style={{ color: subjectColour }}
          >
            Published Lesson
          </p>
        </div>
        <LessonLifecycleIndicator
          status={lifecycleStatus}
          subjectColour={subjectColour}
        />
      </div>
    </Link>
  );
}

function groupLessons(lessons: LearnerPublishedLesson[]): TermGroup[] {
  const termMap = new Map<
    string,
    {
      termNumber: number | null;
      weeks: Map<string, WeekGroup>;
    }
  >();

  for (const lesson of lessons) {
    const termKey =
      lesson.term_number === null
        ? "term-unscheduled"
        : `term-${lesson.term_number}`;
    const weekKey =
      lesson.week_number === null
        ? `${termKey}-week-unscheduled`
        : `${termKey}-week-${lesson.week_number}`;

    if (!termMap.has(termKey)) {
      termMap.set(termKey, {
        termNumber: lesson.term_number,
        weeks: new Map(),
      });
    }

    const term = termMap.get(termKey)!;
    if (!term.weeks.has(weekKey)) {
      term.weeks.set(weekKey, {
        key: weekKey,
        weekNumber: lesson.week_number,
        lessons: [],
      });
    }
    term.weeks.get(weekKey)!.lessons.push(lesson);
  }

  return Array.from(termMap.entries())
    .map(([key, term]) => ({
      key,
      termNumber: term.termNumber,
      weeks: Array.from(term.weeks.values())
        .map((week) => ({
          ...week,
          lessons: [...week.lessons].sort((lessonA, lessonB) =>
            lessonA.lesson_number.localeCompare(
              lessonB.lesson_number,
              undefined,
              { numeric: true },
            ),
          ),
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

export function SubjectClassroom({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const [lessons, setLessons] = useState<LearnerPublishedLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [allLessonsOpen, setAllLessonsOpen] = useState(false);
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPublishedLessons() {
      try {
        setLessonsLoading(true);
        setLoadError("");
        const publishedLessons =
          await getLearnerPublishedLessonsWithCompletion(
            subject.databaseId,
          );
        if (isActive) setLessons(publishedLessons);
      } catch (error) {
        console.error("Failed to load learner lessons:", error);
        if (isActive) {
          setLoadError("Unable to load lessons. Please try again.");
        }
      } finally {
        if (isActive) setLessonsLoading(false);
      }
    }

    void loadPublishedLessons();
    return () => {
      isActive = false;
    };
  }, [subject.databaseId]);

  const latestLesson = [...lessons].sort(compareLatestFirst)[0];
  const lessonLifecycle = getLessonLifecycle(lessons);
  const termGroups = groupLessons(lessons);

  function toggleAllLessons() {
    if (allLessonsOpen) setOpenWeekKey(null);
    setAllLessonsOpen((isOpen) => !isOpen);
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
            <Link href={buildSubjectRoute(subject, "learnerDashboard")}>
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
                {subject.displayName} Classroom
              </h1>
              <p className="text-sm text-blue-100">Teacher</p>
            </div>
          </div>
        </div>

        {lessonsLoading ? (
          <div className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-sm text-black/60 shadow-sm">
            Loading published lessons...
          </div>
        ) : loadError ? (
          <div className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
            {loadError}
          </div>
        ) : !latestLesson ? (
          <div className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-sm text-black/60 shadow-sm">
            No lessons have been published yet.
          </div>
        ) : (
          <>
            <section className="mb-5 w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex w-full min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#102A43]">
                    Current Lesson
                  </h2>
                  <p className="text-sm text-black/60">
                    Most recently published
                  </p>
                </div>
              </div>
              <LessonCard
                lesson={latestLesson}
                lifecycleStatus={lessonLifecycle.statusByLessonId.get(
                  latestLesson.id,
                )!}
                classroomHref={buildSubjectRoute(subject, "learnerClassroom")}
                subjectColour={subject.colourTheme.primary}
              />
            </section>

            <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={toggleAllLessons}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#102A43]">
                    All Lessons
                  </h2>
                  <p className="text-sm text-black/60">
                    Browse lessons by term and week
                  </p>
                </div>
                {allLessonsOpen ? (
                  <ChevronDown size={22} className="text-[var(--subject-primary)]" />
                ) : (
                  <ChevronRight size={22} className="text-[var(--subject-primary)]" />
                )}
              </button>

              {allLessonsOpen && (
                <div className="mt-5 space-y-5">
                  {termGroups.map((term) => (
                    <div key={term.key} className="min-w-0">
                      <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-[#102A43]">
                        {term.termNumber === null
                          ? "Term not set"
                          : `Term ${term.termNumber}`}
                      </h3>
                      <div className="space-y-3">
                        {term.weeks.map((week) => {
                          const weekIsOpen = openWeekKey === week.key;

                          return (
                            <div
                              key={week.key}
                              className="overflow-hidden rounded-2xl border border-[var(--subject-border)]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenWeekKey((currentKey) =>
                                    currentKey === week.key ? null : week.key,
                                  )
                                }
                                className="flex w-full items-center justify-between bg-[var(--subject-card)] p-4 text-left"
                              >
                                <div>
                                  <p className="font-bold text-[#102A43]">
                                    {week.weekNumber === null
                                      ? "Week not set"
                                      : `Week ${week.weekNumber}`}
                                  </p>
                                  <p className="mt-1 text-sm text-black/60">
                                    {week.lessons.length}{" "}
                                    {week.lessons.length === 1
                                      ? "lesson"
                                      : "lessons"}
                                  </p>
                                </div>
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
                              </button>
                              {weekIsOpen && (
                                <div className="w-full min-w-0 space-y-3 border-t border-[var(--subject-border)] p-3">
                                  {week.lessons.map((lesson) => (
                                    <LessonCard
                                      key={lesson.id}
                                      lesson={lesson}
                                      lifecycleStatus={
                                        lessonLifecycle.statusByLessonId.get(
                                          lesson.id,
                                        )!
                                      }
                                      classroomHref={buildSubjectRoute(
                                        subject,
                                        "learnerClassroom",
                                      )}
                                      subjectColour={
                                        subject.colourTheme.primary
                                      }
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function BusinessStudiesClassroom() {
  return <SubjectClassroom />;
}
