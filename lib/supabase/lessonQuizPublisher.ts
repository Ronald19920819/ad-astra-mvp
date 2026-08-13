import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";
import type { LessonQuizOptionLetter } from "@/lib/lessons/lessonQuiz";

type LessonQuizQuestion = {
  id: number;
  questionId?: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: LessonQuizOptionLetter;
  marks: 1;
};

type PublishLessonQuizInput = {
  subjectId: string;
  lessonId: string;
  lessonTitle: string;
  questions: LessonQuizQuestion[];
};

export async function publishLessonQuiz({
  subjectId,
  lessonId,
  lessonTitle,
  questions,
}: PublishLessonQuizInput) {
  return teacherApiRequest<{ id: string }>(
    "/api/teacher/business-studies/lessons",
    {
      method: "POST",
      body: JSON.stringify({
        action: "quiz",
        subjectId,
        lessonId,
        lessonTitle,
        questions,
      }),
    },
  );
}
