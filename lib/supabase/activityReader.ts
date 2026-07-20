import { createClient } from "@/lib/supabase/client";

export type PublishedActivityQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  marks: number;
  assessment_objective: string | null;
  paper: string | null;
  question_type: string | null;
};

export type PublishedActivity = {
  id: string;
  title: string;
  instructions: string | null;
  total_marks: number;
due_date: string | null;
lesson_material_id: string;
  activity_questions: PublishedActivityQuestion[];
};

export async function getPublishedActivity(
  lessonMaterialId: string
): Promise<PublishedActivity | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      title,
      instructions,
      total_marks,
due_date,
lesson_material_id,
      activity_questions (
        id,
        question_number,
        question_text,
        marks,
        assessment_objective,
        paper,
        question_type
      )
    `)
    .eq("lesson_material_id", lessonMaterialId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    activity_questions: [...data.activity_questions].sort(
      (a, b) => a.question_number - b.question_number
    ),
  };
}

export type TeacherPublishedActivity = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  lesson_material_id: string;
  created_at: string;
};

export async function getTeacherPublishedActivities(
  subjectId: string,
): Promise<
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
      created_at,
      lesson_materials!inner (
        material_type,
        lessons!inner (
          subject_id,
          status
        )
      )
    `)
    .in("lesson_materials.material_type", ["activity", "reading"])
    .eq("lesson_materials.lessons.subject_id", subjectId)
    .eq("lesson_materials.lessons.status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((activity) => ({
    id: activity.id,
    title: activity.title,
    total_marks: activity.total_marks,
    due_date: activity.due_date,
    lesson_material_id: activity.lesson_material_id,
    created_at: activity.created_at,
  }));
}

export type LearnerPublishedActivity = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  created_at: string;
  lesson_material_id: string;
  lesson: {
    id: string;
    title: string;
    lesson_number: string;
    term_number: number | null;
    week_number: number | null;
  };
};

type LearnerActivityRow = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  created_at: string;
  lesson_material_id: string;
  lesson_materials: {
    lessons: LearnerPublishedActivity["lesson"];
  };
};

export async function getLearnerPublishedActivities(
  subjectId: string,
): Promise<LearnerPublishedActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      title,
      total_marks,
      due_date,
      created_at,
      lesson_material_id,
      lesson_materials!inner (
        id,
        material_type,
        lesson_id,
        lessons!inner (
          id,
          title,
          lesson_number,
          term_number,
          week_number,
          subject_id,
          status
        )
      )
    `)
    .in("lesson_materials.material_type", ["activity", "reading"])
    .eq("lesson_materials.lessons.subject_id", subjectId)
    .eq("lesson_materials.lessons.status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as LearnerActivityRow[]).map((activity) => ({
    id: activity.id,
    title: activity.title,
    total_marks: activity.total_marks,
    due_date: activity.due_date,
    created_at: activity.created_at,
    lesson_material_id: activity.lesson_material_id,
    lesson: activity.lesson_materials.lessons,
  }));
}

export type LearnerActivityWorkspaceQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  marks: number;
  display_order: number | null;
  assessment_objective: string | null;
  paper: string | null;
  question_type: string | null;
};

export type LearnerActivityWorkspaceData = {
  activity: {
    id: string;
    title: string;
    instructions: string | null;
    total_marks: number;
    due_date: string | null;
    lesson_material_id: string;
  };
  reading: {
    id: string;
    title: string;
    content_text: string;
  };
  lesson: {
    id: string;
    title: string;
    lesson_number: string;
    term_number: number | null;
    week_number: number | null;
  };
  questions: LearnerActivityWorkspaceQuestion[];
};

export type LearnerActivityWorkspaceResult =
  | { status: "success"; data: LearnerActivityWorkspaceData }
  | {
      status: "not-found" | "unpublished" | "wrong-subject" | "missing-reading";
    };

type LinkedActivityMaterialRow = {
  id: string;
  title: string;
  content_text: string | null;
  lesson_id: string;
  material_type: string;
  lessons: {
    id: string;
    title: string;
    lesson_number: string;
    term_number: number | null;
    week_number: number | null;
    subject_id: string;
    status: string;
  };
};

export async function getLearnerActivityData(
  activityId: string,
  subjectId: string,
): Promise<LearnerActivityWorkspaceResult> {
  const supabase = createClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(
      "id, title, instructions, total_marks, due_date, lesson_material_id",
    )
    .eq("id", activityId)
    .maybeSingle();

  if (activityError) {
    throw new Error(activityError.message);
  }

  if (!activity) {
    return { status: "not-found" };
  }

  const { data: materialData, error: materialError } = await supabase
    .from("lesson_materials")
    .select(`
      id,
      title,
      content_text,
      lesson_id,
      material_type,
      lessons!inner (
        id,
        title,
        lesson_number,
        term_number,
        week_number,
        subject_id,
        status
      )
    `)
    .eq("id", activity.lesson_material_id)
    .maybeSingle();

  if (materialError) {
    throw new Error(materialError.message);
  }

  if (!materialData) {
    return { status: "missing-reading" };
  }

  const material = materialData as unknown as LinkedActivityMaterialRow;

  if (material.lessons.status !== "published") {
    return { status: "unpublished" };
  }

  if (material.lessons.subject_id !== subjectId) {
    return { status: "wrong-subject" };
  }

  if (
    material.material_type !== "reading" ||
    !material.content_text?.trim()
  ) {
    return { status: "missing-reading" };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("activity_questions")
    .select(`
      id,
      question_number,
      question_text,
      marks,
      display_order,
      assessment_objective,
      paper,
      question_type
    `)
    .eq("activity_id", activityId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("question_number", { ascending: true });

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  return {
    status: "success",
    data: {
      activity,
      reading: {
        id: material.id,
        title: material.title,
        content_text: material.content_text,
      },
      lesson: {
        id: material.lessons.id,
        title: material.lessons.title,
        lesson_number: material.lessons.lesson_number,
        term_number: material.lessons.term_number,
        week_number: material.lessons.week_number,
      },
      questions: questions ?? [],
    },
  };
}
