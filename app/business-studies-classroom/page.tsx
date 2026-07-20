"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerPublishedLessons,
  type PublishedLesson,
} from "@/lib/supabase/lessonReader";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";
export default function BusinessStudiesClassroom() {
  const [lessons, setLessons] = useState<PublishedLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [previousWeeksOpen, setPreviousWeeksOpen] = useState(false);
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(null);

  useEffect(() => {
    const loadPublishedLessons = async () => {
      try {
        setLessonsLoading(true);

        const publishedLessons =
          await getLearnerPublishedLessons(businessStudiesSubjectId);

        setLessons(publishedLessons);
      } catch (error) {
        console.error("Failed to load learner lessons:", error);
      } finally {
        setLessonsLoading(false);
      }
    };

    loadPublishedLessons();
  }, []);

 const orderedLessons = [...lessons].sort((lessonA, lessonB) => {
  if (lessonA.term_number !== lessonB.term_number) {
    return lessonB.term_number - lessonA.term_number;
  }

  if (lessonA.week_number !== lessonB.week_number) {
    return lessonB.week_number - lessonA.week_number;
  }

  return lessonA.lesson_number.localeCompare(
    lessonB.lesson_number,
    undefined,
    { numeric: true },
  );
});

const newestLesson = orderedLessons[0];

const currentTerm = newestLesson?.term_number ?? null;
const currentWeek = newestLesson?.week_number ?? null;

const currentWeekLessons =
  currentTerm !== null && currentWeek !== null
    ? orderedLessons.filter(
        (lesson) =>
          lesson.term_number === currentTerm &&
          lesson.week_number === currentWeek,
      )
    : [];

const previousLessons = orderedLessons.filter(
  (lesson) =>
    lesson.term_number !== currentTerm ||
    lesson.week_number !== currentWeek,
);

const previousWeekGroups = Object.values(
  previousLessons.reduce<
    Record<
      string,
      {
        key: string;
        termNumber: number;
        weekNumber: number;
        lessons: PublishedLesson[];
      }
    >
  >((groups, lesson) => {
    const key = `${lesson.term_number}-${lesson.week_number}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        termNumber: lesson.term_number,
        weekNumber: lesson.week_number,
        lessons: [],
      };
    }

    groups[key].lessons.push(lesson);

    return groups;
  }, {}),
).sort((groupA, groupB) => {
  if (groupA.termNumber !== groupB.termNumber) {
    return groupB.termNumber - groupA.termNumber;
  }

  return groupB.weekNumber - groupA.weekNumber;
});

return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="mx-auto w-full min-w-0 max-w-md">
        <div className="bg-[#102A43] rounded-[2rem] p-5 text-white mb-6 shadow-lg">
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
                Business Studies Classroom
              </h1>

              <p className="text-sm text-blue-100">
                Teacher Ronald
              </p>
            </div>
          </div>
        </div>

        

        

       

        {lessonsLoading ? (
  <div className="rounded-[2rem] border border-orange-100 bg-white p-5 text-sm text-black/60 shadow-sm">
    Loading published lessons...
  </div>
) : lessons.length === 0 ? (
  <div className="rounded-[2rem] border border-orange-100 bg-white p-5 text-sm text-black/60 shadow-sm">
    No lessons have been published yet.
  </div>
) : (
  <>
    <div className="mb-5 w-full min-w-0 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#102A43]">
            Current Week
          </h2>

          <p className="text-sm text-black/60">
            Week {currentWeek} • Term {currentTerm}
          </p>
        </div>

        <div className="shrink-0 rounded-full bg-[#FFF3E6] px-4 py-2 text-sm font-semibold text-[#F97316]">
          Current
        </div>
      </div>

      <div className="w-full min-w-0 space-y-3">
        {currentWeekLessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/business-studies-classroom/${lesson.id}`}
            className="block w-full min-w-0 rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4 shadow-sm"
          >
            <p className="text-sm font-bold text-black">
              Lesson {lesson.lesson_number} - {lesson.title}
            </p>

            <p className="mt-2 text-sm text-black/60">
              Week {lesson.week_number} • Term {lesson.term_number}
            </p>

            <p className="mt-3 text-xs font-semibold text-[#F97316]">
              Published Lesson
            </p>
          </Link>
        ))}
      </div>
    </div>

    <div className="w-full min-w-0 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() =>
          setPreviousWeeksOpen((currentValue) => !currentValue)
        }
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-bold text-[#102A43]">
            All Weeks
          </h2>

          <p className="text-sm text-black/60">
            Tap a week to view its lessons
          </p>
        </div>

        {previousWeeksOpen ? (
          <ChevronDown size={22} className="text-[#F97316]" />
        ) : (
          <ChevronRight size={22} className="text-[#F97316]" />
        )}
      </button>

      {previousWeeksOpen && (
        <div className="mt-5 w-full min-w-0 space-y-3">
          {previousWeekGroups.length === 0 ? (
            <p className="text-sm text-black/60">
              No previous weeks are available yet.
            </p>
          ) : (
            previousWeekGroups.map((group) => {
              const weekIsOpen = openWeekKey === group.key;

              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-orange-100"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenWeekKey((currentKey) =>
                        currentKey === group.key ? null : group.key,
                      )
                    }
                    className="flex w-full items-center justify-between bg-[#FFFDF9] p-4 text-left"
                  >
                    <div>
                      <p className="font-bold text-[#102A43]">
                        Week {group.weekNumber} • Term{" "}
                        {group.termNumber}
                      </p>

                      <p className="mt-1 text-sm text-black/60">
                        {group.lessons.length}{" "}
                        {group.lessons.length === 1
                          ? "lesson"
                          : "lessons"}
                      </p>
                    </div>

                    {weekIsOpen ? (
                      <ChevronDown
                        size={20}
                        className="text-[#F97316]"
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        className="text-[#F97316]"
                      />
                    )}
                  </button>

                  {weekIsOpen && (
                    <div className="w-full min-w-0 space-y-3 border-t border-orange-100 p-3">
                      {group.lessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/business-studies-classroom/${lesson.id}`}
                          className="block w-full min-w-0 rounded-2xl border border-orange-100 bg-white p-4"
                        >
                          <p className="text-sm font-bold text-black">
                            Lesson {lesson.lesson_number} -{" "}
                            {lesson.title}
                          </p>

                          <p className="mt-3 text-xs font-semibold text-[#F97316]">
                            Published Lesson
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  </>
)}
      </div>
    </main>
  );
}
