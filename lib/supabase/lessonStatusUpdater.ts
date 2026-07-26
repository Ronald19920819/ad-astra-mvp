import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

export async function updateLessonStatus(
  subjectId: string,
  lessonId: string,
  status: "draft" | "published",
) {
  return teacherApiRequest<{ id: string; status: "draft" | "published" }>(
    "/api/teacher/business-studies/lessons",
    {
      method: "POST",
      body: JSON.stringify({ action: "status", subjectId, lessonId, status }),
    },
  );
}
