export type LessonLifecycleStatus =
  | "current"
  | "completed"
  | "attention_required";

export type LessonLifecycleInput = {
  id: string;
  created_at: string;
  expected_completion_date: string | null;
  isCompleted: boolean;
};

export type LessonLifecycleResult = {
  currentLessonId: string | null;
  statusByLessonId: Map<string, LessonLifecycleStatus>;
};

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function comparePublishedNewestFirst(
  lessonA: LessonLifecycleInput,
  lessonB: LessonLifecycleInput,
) {
  const createdDifference =
    new Date(lessonB.created_at).getTime() -
    new Date(lessonA.created_at).getTime();
  return createdDifference || lessonA.id.localeCompare(lessonB.id);
}

export function getLessonLifecycle(
  lessons: LessonLifecycleInput[],
  now = new Date(),
  timeZone = "Africa/Johannesburg",
): LessonLifecycleResult {
  const orderedLessons = [...lessons].sort(comparePublishedNewestFirst);
  const today = dateKeyInTimeZone(now, timeZone);
  const activeDatedLessons = orderedLessons
    .filter(
      (lesson) =>
        !lesson.isCompleted &&
        lesson.expected_completion_date !== null &&
        lesson.expected_completion_date >= today,
    )
    .sort((lessonA, lessonB) => {
      const dateDifference = (
        lessonA.expected_completion_date as string
      ).localeCompare(lessonB.expected_completion_date as string);
      return dateDifference || comparePublishedNewestFirst(lessonA, lessonB);
    });

  const newestPublishedLesson = orderedLessons[0];
  const currentLessonId =
    newestPublishedLesson && !newestPublishedLesson.isCompleted
      ? newestPublishedLesson.id
      : (activeDatedLessons[0]?.id ?? null);

  const statusByLessonId = new Map<string, LessonLifecycleStatus>();
  for (const lesson of orderedLessons) {
    const status: LessonLifecycleStatus = lesson.isCompleted
      ? "completed"
      : lesson.id === currentLessonId
        ? "current"
        : "attention_required";
    statusByLessonId.set(lesson.id, status);
  }

  return { currentLessonId, statusByLessonId };
}
