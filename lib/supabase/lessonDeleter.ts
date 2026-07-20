import { createClient } from "@/lib/supabase/client";

export async function deleteDraftLesson(lessonId: string) {
  const supabase = createClient();

  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select("id")
    .eq("lesson_id", lessonId);

  if (materialsError) {
    throw new Error(materialsError.message);
  }

  const materialIds = (materials ?? []).map((material) => material.id);

  if (materialIds.length > 0) {
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("id")
      .in("lesson_material_id", materialIds);

    if (activitiesError) {
      throw new Error(activitiesError.message);
    }

    const activityIds = (activities ?? []).map((activity) => activity.id);

    if (activityIds.length > 0) {
      const { error: questionsError } = await supabase
        .from("activity_questions")
        .delete()
        .in("activity_id", activityIds);

      if (questionsError) {
        throw new Error(questionsError.message);
      }

      const { error: activityDeleteError } = await supabase
        .from("activities")
        .delete()
        .in("id", activityIds);

      if (activityDeleteError) {
        throw new Error(activityDeleteError.message);
      }
    }

    const { error: materialsDeleteError } = await supabase
      .from("lesson_materials")
      .delete()
      .eq("lesson_id", lessonId);

    if (materialsDeleteError) {
      throw new Error(materialsDeleteError.message);
    }
  }

  const { error: lessonError } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("status", "draft");

  if (lessonError) {
    throw new Error(lessonError.message);
  }
}