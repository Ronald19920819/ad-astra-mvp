import { createClient } from "@/lib/supabase/client";

type LessonQuizQuestion = {
  id: number;
  questionText: string;
  answerText: string;
  marks: 1;
};

type PublishLessonQuizInput = {
  lessonId: string;
  lessonTitle: string;
  questions: LessonQuizQuestion[];
};

export async function publishLessonQuiz({
  lessonId,
  lessonTitle,
  questions,
}: PublishLessonQuizInput) {
  const supabase = createClient();

  // Remove any existing quiz for this lesson before creating a new one.
const { data: existingQuiz } = await supabase
  .from("lesson_materials")
  .select("id")
  .eq("lesson_id", lessonId)
  .eq("material_type", "quiz")
  .maybeSingle();

if (existingQuiz) {
  const { data: existingActivity } = await supabase
    .from("activities")
    .select("id")
    .eq("lesson_material_id", existingQuiz.id)
    .maybeSingle();

  if (existingActivity) {
    await supabase
      .from("activity_questions")
      .delete()
      .eq("activity_id", existingActivity.id);

    await supabase
      .from("activities")
      .delete()
      .eq("id", existingActivity.id);
  }

  await supabase
    .from("lesson_materials")
    .delete()
    .eq("id", existingQuiz.id);
}

  const { data: quizMaterial, error: materialError } = await supabase
    .from("lesson_materials")
    .insert({
      lesson_id: lessonId,
      material_type: "quiz",
      source_type: "pasted_text",
      title: `${lessonTitle} Quiz`,
      required: true,
      display_order: 3,
    })
    .select("id")
    .single();

  if (materialError) {
    throw new Error(materialError.message);
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({
      title: `${lessonTitle} Quiz`,
      instructions: "Answer all 10 questions.",
      total_marks: 10,
      lesson_material_id: quizMaterial.id,
      due_date: null,
    })
    .select("id")
    .single();

  if (activityError) {
    throw new Error(activityError.message);
  }

  const questionRows = questions.map((question, index) => ({
    activity_id: activity.id,
    question_number: index + 1,
    question_text: question.questionText.trim(),
    answer_text: question.answerText.trim(),
    marks: 1,
    display_order: index + 1,
    assessment_objective: null,
    guidance: null,
    paper: null,
    question_type: null,
  }));

  const { error: questionsError } = await supabase
    .from("activity_questions")
    .insert(questionRows);

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  return activity;
}