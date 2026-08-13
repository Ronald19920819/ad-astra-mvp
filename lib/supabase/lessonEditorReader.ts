import { createClient } from "@/lib/supabase/client";
import type { LessonQuizOptionLetter } from "@/lib/lessons/lessonQuiz";

export type LessonEditorQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  answer_text: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: LessonQuizOptionLetter | null;
  marks: number;
};

export type LessonEditorData = {
  lesson: {
    id: string;
    lesson_number: string;
    title: string;
    term_number: number | null;
    week_number: number | null;
    topic_id: string | null;
    expected_completion_date: string | null;
    status: "draft" | "published";
  };
  reading: {
    id: string;
    title: string;
    content_text: string | null;
  } | null;
  video: {
    id: string;
    title: string;
    content_url: string | null;
  } | null;
  quiz: {
    materialId: string;
    activityId: string;
    title: string;
    questions: LessonEditorQuestion[];
  } | null;
};

export async function getLessonEditorData(
  lessonId: string,
  subjectId: string,
): Promise<LessonEditorData> {
  const supabase = createClient();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      id,
      subject_id,
      lesson_number,
      title,
      term_number,
      week_number,
      topic_id,
      expected_completion_date,
      status
      `,
    )
    .eq("id", lessonId)
    .single();

  if (lessonError) {
    throw new Error(lessonError.message);
  }
  if (lesson.subject_id !== subjectId) {
    throw new Error("The lesson belongs to a different subject.");
  }

  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select(
      `
      id,
      material_type,
      title,
      content_text,
      content_url
      `,
    )
    .eq("lesson_id", lessonId)
    .order("display_order", { ascending: true });

  if (materialsError) {
    throw new Error(materialsError.message);
  }

  const readingMaterial =
    materials?.find((material) => material.material_type === "reading") ?? null;

  const videoMaterial =
    materials?.find((material) => material.material_type === "video") ?? null;

  const quizMaterial =
    materials?.find((material) => material.material_type === "quiz") ?? null;

  let quiz: LessonEditorData["quiz"] = null;

  if (quizMaterial) {
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, title")
      .eq("lesson_material_id", quizMaterial.id)
      .single();

    if (activityError) {
      throw new Error(activityError.message);
    }

    const { data: questions, error: questionsError } = await supabase
      .from("activity_questions")
      .select(
        `
        id,
        question_number,
        question_text,
        answer_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        marks
        `,
      )
      .eq("activity_id", activity.id)
      .order("question_number", { ascending: true });

    if (questionsError) {
      throw new Error(questionsError.message);
    }

    quiz = {
      materialId: quizMaterial.id,
      activityId: activity.id,
      title: activity.title,
      questions: (questions ?? []) as LessonEditorQuestion[],
    };
  }

  return {
    lesson: {
      id: lesson.id,
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      term_number: lesson.term_number,
      week_number: lesson.week_number,
      topic_id: lesson.topic_id,
      expected_completion_date: lesson.expected_completion_date,
      status: lesson.status,
    },
    reading: readingMaterial
      ? {
          id: readingMaterial.id,
          title: readingMaterial.title,
          content_text: readingMaterial.content_text,
        }
      : null,
    video: videoMaterial
      ? {
          id: videoMaterial.id,
          title: videoMaterial.title,
          content_url: videoMaterial.content_url,
        }
      : null,
    quiz,
  };
}
