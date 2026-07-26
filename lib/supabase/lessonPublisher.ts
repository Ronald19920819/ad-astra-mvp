import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

type PublishLessonInput = {
  subjectId: string;
  lessonNumber: string;
  title: string;
  description?: string;
  displayOrder?: number;
  termNumber: number;
  weekNumber: number;
  topicId?: string | null;
  expectedCompletionDate?: string | null;
  status?: "draft" | "published";
};

export async function publishLesson({
  subjectId,
  lessonNumber,
  title,
  description,
  displayOrder,
  termNumber,
  weekNumber,
  topicId = null,
  expectedCompletionDate = null,
  status = "draft",
}: PublishLessonInput) {
  return teacherApiRequest<{ id: string }>(
    "/api/teacher/business-studies/lessons",
    {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        subjectId,
        lessonNumber,
        title,
        description,
        displayOrder,
        termNumber,
        weekNumber,
        topicId,
        expectedCompletionDate,
        status,
      }),
    },
  );
}
