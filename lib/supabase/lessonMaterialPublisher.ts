import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

type PublishLessonMaterialInput = {
  subjectId: string;
  lessonId: string;
  materialType: "reading" | "video" | "quiz";
  sourceType: "pasted_text" | "pdf" | "youtube";
  title: string;
  required: boolean;
  contentUrl?: string | null;
  contentText?: string | null;
  displayOrder?: number;
};

export async function publishLessonMaterial({
  subjectId,
  lessonId,
  materialType,
  sourceType,
  title,
  required,
  contentUrl = null,
  contentText = null,
  displayOrder = 0,
}: PublishLessonMaterialInput) {
  return teacherApiRequest<{ id: string }>(
    "/api/teacher/business-studies/lessons",
    {
      method: "POST",
      body: JSON.stringify({
        action: "material",
        subjectId,
        lessonId,
        materialType,
        sourceType,
        title,
        required,
        contentUrl,
        contentText,
        displayOrder,
      }),
    },
  );
}
