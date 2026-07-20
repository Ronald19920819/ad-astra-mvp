import { createClient } from "@/lib/supabase/client";
import type { ActivityQuestion } from "@/components/activities/ActivityQuestionBuilder";

type PublishActivityInput = {
  title: string;
  lessonId: string;
  totalMarks: number;
  dueDate: string;
  questions: ActivityQuestion[];
};

export async function publishActivityToSupabase({
  title,
  lessonId,
  totalMarks,
  dueDate,
  questions,
}: PublishActivityInput) {
  const supabase = createClient();

  const { data: readingMaterial, error: readingMaterialError } = await supabase
    .from("lesson_materials")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("material_type", "reading")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readingMaterialError) {
    throw new Error(readingMaterialError.message);
  }

  if (!readingMaterial) {
    throw new Error(
      "The selected lesson has no reading material to link to this activity.",
    );
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({
      title,
      instructions: "Complete all questions. Answer in full sentences.",
      total_marks: totalMarks,
      lesson_material_id: readingMaterial.id,
      due_date: dueDate || null,
    })
    .select("id")
    .single();

  if (activityError) {
    throw new Error(activityError.message);
  }

  const questionRows = questions.map((question, index) => ({
    activity_id: activity.id,
    question_number: index + 1,
    paper: question.paper,
    question_type: question.questionType,
    question_text: question.questionText.trim(),
    marks: Number(question.marks),
    assessment_objective: question.ao,
    guidance: question.guidance,
  }));

  const { error: questionsError } = await supabase
    .from("activity_questions")
    .insert(questionRows);

  if (questionsError) {
    const { error: cleanupError } = await supabase
      .from("activities")
      .delete()
      .eq("id", activity.id);

    if (cleanupError) {
      console.error("Activity cleanup error:", {
        activityId: activity.id,
        message: cleanupError.message,
        code: cleanupError.code,
      });
    }

    throw new Error(questionsError.message);
  }

  return activity;
}
export type TeacherPublishedActivity = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  lesson_material_id: string;
  created_at: string;
};

export async function getTeacherPublishedActivities(): Promise<
  TeacherPublishedActivity[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      title,
      total_marks,
      due_date,
      lesson_material_id,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
