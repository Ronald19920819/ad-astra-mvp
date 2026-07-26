import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

type LessonQuizQuestion = {
  id: number;
  questionId?: string;
  questionText: string;
  answerText: string;
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
