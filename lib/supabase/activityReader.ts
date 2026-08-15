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
  lessonMaterialId: string,
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
      (a, b) => a.question_number - b.question_number,
    ),
  };
}

export type TeacherPublishedActivity = {
  id: string;
  version: number;
  title: string;
  total_marks: number;
  due_date: string | null;
  lesson_material_id: string;
  created_at: string;
  submissionCount: number;
};

export type TeacherActivityEditorData = {
  activity: Omit<TeacherPublishedActivity, "submissionCount"> & {
    instructions: string;
    lessonId: string;
  };
  questions: {
    id: string;
    paper: string | null;
    question_type: string | null;
    question_text: string;
    marks: number;
    assessment_objective: string | null;
    guidance: string | null;
  }[];
};

export async function getTeacherPublishedActivities(
  subjectId: string,
): Promise<TeacherPublishedActivity[]> {
  const response = await fetch(
    `/api/teacher/business-studies/activities?subjectId=${encodeURIComponent(subjectId)}`,
    { cache: "no-store" },
  );
  const result = (await response.json()) as {
    data?: TeacherPublishedActivity[];
    error?: string;
  };

  if (!response.ok || !result.data) {
    throw new Error(result.error || "Published activities could not be loaded.");
  }

  return result.data;
}

export async function getTeacherActivityEditorData(
  activityId: string,
  subjectId: string,
): Promise<TeacherActivityEditorData> {
  const supabase = createClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(
      "id, version, title, instructions, total_marks, due_date, lesson_material_id, created_at",
    )
    .eq("id", activityId)
    .single();

  if (activityError) throw new Error(activityError.message);

  const { data: material, error: materialError } = await supabase
    .from("lesson_materials")
    .select("lesson_id")
    .eq("id", activity.lesson_material_id)
    .single();

  if (materialError) throw new Error(materialError.message);

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", material.lesson_id)
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .maybeSingle();

  if (lessonError) throw new Error(lessonError.message);
  if (!lesson) {
    throw new Error("The linked published Business Studies lesson was not found.");
  }

  const { data: questions, error: questionsError } = await supabase
    .from("activity_questions")
    .select(
      "id, paper, question_type, question_text, marks, assessment_objective, guidance, display_order, question_number",
    )
    .eq("activity_id", activityId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("question_number", { ascending: true });

  if (questionsError) throw new Error(questionsError.message);

  return {
    activity: {
      id: activity.id,
      version: activity.version,
      title: activity.title,
      instructions: activity.instructions ?? "",
      total_marks: activity.total_marks,
      due_date: activity.due_date,
      lesson_material_id: activity.lesson_material_id,
      created_at: activity.created_at,
      lessonId: lesson.id,
    },
    questions: questions ?? [],
  };
}

export type LearnerPublishedActivity = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  created_at: string;
  lesson_material_id: string;
  isSubmitted: boolean;
  submissionStatus:
    | "submitted"
    | "marking_failed"
    | "awaiting_review"
    | "returned"
    | null;
  preliminaryMark?: number | null;
  preliminaryTotal?: number | null;
  preliminaryPercentage?: number | null;
  finalMark?: number | null;
  originalTotalMarks?: number | null;
  snapshotTotalMarks?: number | null;
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

type LearnerActivitySubmissionRow = {
  activity_id: string;
  status: NonNullable<LearnerPublishedActivity["submissionStatus"]>;
  submitted_at: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  preliminary_percentage: number | null;
  final_mark: number | null;
  original_total_marks: number | null;
  activity_snapshot: {
    activity?: {
      totalMarks?: number;
    };
  } | null;
};

function getSnapshotTotalMarks(
  snapshot: LearnerActivitySubmissionRow["activity_snapshot"],
) {
  const totalMarks = snapshot?.activity?.totalMarks;
  return typeof totalMarks === "number" && Number.isFinite(totalMarks)
    ? totalMarks
    : null;
}

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

  const activities = (data ?? []) as unknown as LearnerActivityRow[];

  if (activities.length === 0) return [];

  const { data: submissions, error: submissionsError } = await supabase
    .from("activity_submissions")
    .select(
      "activity_id, status, submitted_at, preliminary_mark, preliminary_total, preliminary_percentage, final_mark, original_total_marks, activity_snapshot",
    )
    .in(
      "activity_id",
      activities.map((activity) => activity.id),
    )
    .order("submitted_at", { ascending: false });

  if (submissionsError) {
    console.error("Supabase learner activity submission loading error:", {
      message: submissionsError.message,
      details: submissionsError.details,
      hint: submissionsError.hint,
      code: submissionsError.code,
    });
    throw new Error(submissionsError.message);
  }

  const submissionRows = (submissions ?? []) as LearnerActivitySubmissionRow[];
  const submissionByActivityId = new Map<string, LearnerActivitySubmissionRow>();

  for (const submission of submissionRows) {
    if (!submissionByActivityId.has(submission.activity_id)) {
      submissionByActivityId.set(submission.activity_id, submission);
    }
  }

  return activities.map((activity) => {
    const submission = submissionByActivityId.get(activity.id);

    return {
      id: activity.id,
      title: activity.title,
      total_marks: activity.total_marks,
      due_date: activity.due_date,
      created_at: activity.created_at,
      lesson_material_id: activity.lesson_material_id,
      isSubmitted: Boolean(submission),
      submissionStatus: submission?.status ?? null,
      preliminaryMark: submission?.preliminary_mark ?? null,
      preliminaryTotal: submission?.preliminary_total ?? null,
      preliminaryPercentage: submission?.preliminary_percentage ?? null,
      finalMark: submission?.final_mark ?? null,
      originalTotalMarks: submission?.original_total_marks ?? null,
      snapshotTotalMarks: getSnapshotTotalMarks(
        submission?.activity_snapshot ?? null,
      ),
      lesson: activity.lesson_materials.lessons,
    };
  });
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
    version: number;
    title: string;
    instructions: string | null;
    total_marks: number;
    due_date: string | null;
    lesson_material_id: string;
  };
  reading: {
    id: string;
    title: string;
    source_type: "pasted_text" | "pdf";
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
  source_type: string;
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
      "id, version, title, instructions, total_marks, due_date, lesson_material_id",
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
      source_type,
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
    (material.source_type !== "pdf" && !material.content_text?.trim())
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
        source_type: material.source_type === "pdf" ? "pdf" : "pasted_text",
        content_text: material.content_text ?? "",
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
