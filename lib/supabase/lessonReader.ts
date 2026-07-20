import { createClient } from "@/lib/supabase/client";

export type PublishedLesson = {
  id: string;
  subject_id: string;
  lesson_number: string;
  title: string;
  description: string | null;
  display_order: number | null;
  term_number: number;
  week_number: number;
  created_at: string;
  status: "draft" | "published";
};

export type LearnerLessonQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  marks: number;
  display_order: number;
};

export type LearnerLessonData = {
  lesson: Pick<
    PublishedLesson,
    "id" | "lesson_number" | "title" | "term_number" | "week_number"
  >;
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
    id: string;
    title: string;
    questions: LearnerLessonQuestion[];
  } | null;
};

export async function getTeacherPublishedLessons(
  subjectId: string
): Promise<PublishedLesson[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id,
      subject_id,
      lesson_number,
      title,
      description,
      display_order,
      term_number,
      week_number,
      status,
      created_at
      `
    )
    .eq("subject_id", subjectId)
    .order("term_number", { ascending: true })
    .order("week_number", { ascending: true })
    .order("display_order", { ascending: true })
    .order("lesson_number", { ascending: true });

  if (error) {
    console.error("Supabase lesson loading error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLearnerPublishedLessons(
  subjectId: string
): Promise<PublishedLesson[]> {
  const lessons = await getTeacherPublishedLessons(subjectId);

  return lessons.filter((lesson) => lesson.status === "published");
}

export async function getLearnerLessonData(
  lessonId: string
): Promise<LearnerLessonData | null> {
  const supabase = createClient();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, lesson_number, title, term_number, week_number")
    .eq("id", lessonId)
    .eq("status", "published")
    .maybeSingle();

  if (lessonError) {
    throw new Error(lessonError.message);
  }

  if (!lesson) {
    return null;
  }

  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select("id, material_type, title, content_text, content_url")
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

  let quiz: LearnerLessonData["quiz"] = null;

  if (quizMaterial) {
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, title")
      .eq("lesson_material_id", quizMaterial.id)
      .maybeSingle();

    if (activityError) {
      throw new Error(activityError.message);
    }

    if (activity) {
      const { data: questions, error: questionsError } = await supabase
        .from("activity_questions")
        .select("id, question_number, question_text, marks, display_order")
        .eq("activity_id", activity.id)
        .order("display_order", { ascending: true });

      if (questionsError) {
        throw new Error(questionsError.message);
      }

      quiz = {
        id: activity.id,
        title: activity.title,
        questions: questions ?? [],
      };
    }
  }

  return {
    lesson,
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
