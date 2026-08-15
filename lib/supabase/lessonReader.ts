import { createClient } from "@/lib/supabase/client";

export type PublishedLesson = {
  id: string;
  subject_id: string;
  lesson_number: string;
  title: string;
  description: string | null;
  display_order: number | null;
  term_number: number | null;
  week_number: number | null;
  expected_completion_date: string | null;
  created_at: string;
  status: "draft" | "published";
};

export type TeacherLessonContentSummary = {
  hasReading: boolean;
  hasVideo: boolean;
  hasQuiz: boolean;
  hasActivity: boolean;
};

export type TeacherPublishedLesson = PublishedLesson & {
  contentSummary: TeacherLessonContentSummary;
};

export type LearnerPublishedLesson = PublishedLesson & {
  isCompleted: boolean;
};

export type LearnerLessonQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  marks: number;
  display_order: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

export type LearnerLessonData = {
  lesson: Pick<
    PublishedLesson,
    "id" | "lesson_number" | "title" | "term_number" | "week_number"
  >;
  reading: {
    id: string;
    title: string;
    source_type: "pasted_text" | "pdf";
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
  passedQuizAttempt: {
    id: string;
    quiz_score: number;
    quiz_total: number;
    created_at: string;
    completed_at: string | null;
  } | null;
  completion: {
    completed_at: string;
    quiz_score: number;
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
      expected_completion_date,
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

export async function getTeacherPublishedLessonsWithContentSummary(
  subjectId: string,
): Promise<TeacherPublishedLesson[]> {
  const lessons = await getTeacherPublishedLessons(subjectId);
  if (lessons.length === 0) return [];

  const supabase = createClient();
  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id, material_type")
    .in(
      "lesson_id",
      lessons.map((lesson) => lesson.id),
    );

  if (materialsError) {
    throw new Error(materialsError.message);
  }

  const activityMaterialIds = (materials ?? [])
    .filter((material) => material.material_type !== "quiz")
    .map((material) => material.id);
  const activityLessonIds = new Set<string>();

  if (activityMaterialIds.length > 0) {
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("lesson_material_id")
      .in("lesson_material_id", activityMaterialIds);

    if (activitiesError) {
      throw new Error(activitiesError.message);
    }

    const materialLessonIds = new Map(
      (materials ?? []).map((material) => [material.id, material.lesson_id]),
    );
    for (const activity of activities ?? []) {
      const lessonId = materialLessonIds.get(activity.lesson_material_id);
      if (lessonId) activityLessonIds.add(lessonId);
    }
  }

  const materialTypesByLesson = new Map<string, Set<string>>();
  for (const material of materials ?? []) {
    const materialTypes =
      materialTypesByLesson.get(material.lesson_id) ?? new Set<string>();
    materialTypes.add(material.material_type);
    materialTypesByLesson.set(material.lesson_id, materialTypes);
  }

  return lessons.map((lesson) => {
    const materialTypes =
      materialTypesByLesson.get(lesson.id) ?? new Set<string>();
    return {
      ...lesson,
      contentSummary: {
        hasReading: materialTypes.has("reading"),
        hasVideo: materialTypes.has("video"),
        hasQuiz: materialTypes.has("quiz"),
        hasActivity: activityLessonIds.has(lesson.id),
      },
    };
  });
}

export async function getLearnerPublishedLessons(
  subjectId: string
): Promise<PublishedLesson[]> {
  const lessons = await getTeacherPublishedLessons(subjectId);

  return lessons.filter((lesson) => lesson.status === "published");
}

export async function getLearnerPublishedLessonsWithCompletion(
  subjectId: string,
): Promise<LearnerPublishedLesson[]> {
  const lessons = await getLearnerPublishedLessons(subjectId);

  if (lessons.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("learner_lesson_completions")
    .select("lesson_id")
    .in(
      "lesson_id",
      lessons.map((lesson) => lesson.id),
    );

  if (error) {
    console.error("Supabase learner completion loading error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(error.message);
  }

  const completedLessonIds = new Set(
    (data ?? []).map((completion) => completion.lesson_id),
  );

  return lessons.map((lesson) => ({
    ...lesson,
    isCompleted: completedLessonIds.has(lesson.id),
  }));
}

export async function getLearnerLessonData(
  lessonId: string,
  subjectId?: string,
): Promise<LearnerLessonData | null> {
  const supabase = createClient();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, subject_id, lesson_number, title, term_number, week_number")
    .eq("id", lessonId)
    .eq("status", "published")
    .maybeSingle();

  if (lessonError) {
    throw new Error(lessonError.message);
  }

  if (!lesson) {
    return null;
  }
  if (subjectId && lesson.subject_id !== subjectId) {
    return null;
  }

  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select("id, material_type, source_type, title, content_text, content_url")
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
        .select("id, question_number, question_text, marks, display_order, option_a, option_b, option_c, option_d")
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

  const [attemptResult, completionResult] = await Promise.all([
    supabase
      .from("learner_quiz_attempts")
      .select("id, quiz_score, quiz_total, created_at, completed_at")
      .eq("lesson_id", lessonId)
      .eq("passed", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("learner_lesson_completions")
      .select("completed_at, quiz_score")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  if (attemptResult.error) {
    throw new Error(attemptResult.error.message);
  }

  if (completionResult.error) {
    throw new Error(completionResult.error.message);
  }

  return {
    lesson: {
      id: lesson.id,
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      term_number: lesson.term_number,
      week_number: lesson.week_number,
    },
    reading: readingMaterial
      ? {
          id: readingMaterial.id,
          title: readingMaterial.title,
          source_type:
            readingMaterial.source_type === "pdf" ? "pdf" : "pasted_text",
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
    passedQuizAttempt: attemptResult.data,
    completion: completionResult.data,
  };
}
