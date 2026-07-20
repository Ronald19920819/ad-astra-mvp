import { createClient } from "@/lib/supabase/client";

export async function updateLessonStatus(
  lessonId: string,
  status: "draft" | "published",
) {
  const supabase = createClient();

  const { data, error } = await supabase
  .from("lessons")
  .update({
    status,
  })
  .eq("id", lessonId)
  .select("id, status")
  .maybeSingle();

if (error) {
  throw new Error(error.message);
}

if (!data) {
  throw new Error(
    "The lesson was not updated. Check the lesson ID and Supabase update permissions.",
  );
}

return data;
}