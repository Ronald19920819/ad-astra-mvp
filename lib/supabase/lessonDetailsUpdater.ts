import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

type UpdateLessonDetailsInput = {
  subjectId: string;
  lessonId: string;
  lessonNumber: string;
  title: string;
  termNumber: number;
  weekNumber: number;
  topicId: string | null;
  expectedCompletionDate: string | null;
};

export async function updateLessonDetails({
  subjectId,
  lessonId,
  lessonNumber,
  title,
  termNumber,
  weekNumber,
  topicId,
  expectedCompletionDate,
}: UpdateLessonDetailsInput) {
  return teacherApiRequest<{ id: string }>(
    "/api/teacher/business-studies/lessons",
    {
      method: "POST",
      body: JSON.stringify({
        action: "details",
        subjectId,
        lessonId,
        lessonNumber,
        title,
        termNumber,
        weekNumber,
        topicId,
        expectedCompletionDate,
      }),
    },
  );
}
