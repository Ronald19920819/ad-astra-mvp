import { createClient } from "@/lib/supabase/client";

type PublishLessonInput = {
  subjectId: string;
  lessonNumber: string;
  title: string;
  description?: string;
  displayOrder?: number;
  termNumber: number;
  weekNumber: number;
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
  status = "draft",
}: PublishLessonInput) {
    const supabase = createClient();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
  subject_id: subjectId,
  lesson_number: lessonNumber,
  title,
  description: description ?? "",
  display_order: displayOrder ?? 0,
  term_number: termNumber,
  week_number: weekNumber,
  status,
  
})
    .select()
    .single();

  if (error) {
  console.error("Supabase lesson publish error:", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });

  throw new Error(error.message);
}

  return data;
}