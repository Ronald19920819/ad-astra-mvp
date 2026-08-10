import "server-only";

import type { ActivitySubmissionSnapshot } from "@/lib/activities/activitySnapshot";
import type {
  LearnerActivityWorkspaceResult,
  LearnerPublishedActivity,
} from "@/lib/supabase/activityReader";
import type {
  LearnerLessonData,
  LearnerPublishedLesson,
} from "@/lib/supabase/lessonReader";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { createSupabaseRequestClient } from "@/lib/supabase/server";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";

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
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

export type LearnerActivitySubmissionAnswer = {
  id: string;
  question_id: string;
  answer_text: string;
  kingdom_mark: number | null;
  kingdom_feedback: string | null;
  kingdom_judgement: "correct" | "partially_correct" | "incorrect" | null;
  teacher_mark: number | null;
  teacher_feedback: string | null;
};

export type LearnerSavedActivitySubmission = {
  id: string;
  activity_id: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
  submitted_at: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  preliminary_percentage: number | null;
  kingdom_marked_at: string | null;
  final_mark: number | null;
  reviewed_at: string | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
  submitted_activity_version: number | null;
  original_total_marks: number | null;
  snapshot_created_at: string | null;
  activity_submission_answers: LearnerActivitySubmissionAnswer[];
};

function ensureLearnerSubjectAccess(subjectId: string) {
  return getAuthenticatedLearnerProfile().then((profile) => {
    if (!profile) {
      throw new Error("Learner profile unavailable.");
    }

    const access = verifyLearnerSubjectAccessForProfile(profile, subjectId);
    if (!access.allowed) {
      throw new Error("Learner subject enrolment is required.");
    }

    return profile;
  });
}

function getSnapshotTotalMarks(snapshot: ActivitySubmissionSnapshot | null) {
  const totalMarks = snapshot?.activity?.totalMarks;
  return typeof totalMarks === "number" && Number.isFinite(totalMarks)
    ? totalMarks
    : null;
}

export async function getLearnerPublishedLessonsWithCompletionServer(
  subjectId: string,
): Promise<LearnerPublishedLesson[]> {
  const profile = await ensureLearnerSubjectAccess(subjectId);
  const supabase = await createSupabaseRequestClient();

  const { data: lessons, error: lessonsError } = await supabase
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
      `,
    )
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .order("term_number", { ascending: true })
    .order("week_number", { ascending: true })
    .order("display_order", { ascending: true })
    .order("lesson_number", { ascending: true });

  if (lessonsError) throw new Error(lessonsError.message);
  if (!lessons?.length) return [];

  const { data: completions, error: completionsError } = await supabase
    .from("learner_lesson_completions")
    .select("lesson_id")
    .eq("learner_id", profile.userId)
    .in(
      "lesson_id",
      lessons.map((lesson) => lesson.id),
    );

  if (completionsError) throw new Error(completionsError.message);

  const completedLessonIds = new Set(
    (completions ?? []).map((completion) => completion.lesson_id),
  );

  return lessons.map((lesson) => ({
    ...lesson,
    isCompleted: completedLessonIds.has(lesson.id),
  }));
}

export async function getLearnerPublishedActivitiesServer(
  subjectId: string,
): Promise<LearnerPublishedActivity[]> {
  const profile = await ensureLearnerSubjectAccess(subjectId);
  const supabase = await createSupabaseRequestClient();

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

  if (error) throw new Error(error.message);
  const activities = (data ?? []) as unknown as LearnerActivityRow[];
  if (!activities.length) return [];

  const { data: submissions, error: submissionsError } = await supabase
    .from("activity_submissions")
    .select(
      "activity_id, status, submitted_at, preliminary_mark, preliminary_total, preliminary_percentage, final_mark, original_total_marks, activity_snapshot",
    )
    .eq("learner_id", profile.userId)
    .in(
      "activity_id",
      activities.map((activity) => activity.id),
    )
    .order("submitted_at", { ascending: false });

  if (submissionsError) throw new Error(submissionsError.message);

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

export async function getLearnerLessonDataServer(
  lessonId: string,
  subjectId: string,
): Promise<LearnerLessonData | null> {
  const profile = await ensureLearnerSubjectAccess(subjectId);
  const supabase = await createSupabaseRequestClient();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, subject_id, lesson_number, title, term_number, week_number")
    .eq("id", lessonId)
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .maybeSingle();

  if (lessonError) throw new Error(lessonError.message);
  if (!lesson) return null;

  const [materialsResult, attemptResult, completionResult] =
    await Promise.all([
      supabase
        .from("lesson_materials")
        .select("id, material_type, title, content_text, content_url")
        .eq("lesson_id", lessonId)
        .order("display_order", { ascending: true }),
      supabase
        .from("learner_quiz_attempts")
        .select("id, quiz_score, quiz_total, created_at, completed_at")
        .eq("learner_id", profile.userId)
        .eq("lesson_id", lessonId)
        .eq("passed", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("learner_lesson_completions")
        .select("completed_at, quiz_score")
        .eq("learner_id", profile.userId)
        .eq("lesson_id", lessonId)
        .maybeSingle(),
    ]);

  if (materialsResult.error) throw new Error(materialsResult.error.message);
  if (attemptResult.error) throw new Error(attemptResult.error.message);
  if (completionResult.error) throw new Error(completionResult.error.message);

  const materials = materialsResult.data ?? [];
  const readingMaterial =
    materials.find((material) => material.material_type === "reading") ?? null;
  const videoMaterial =
    materials.find((material) => material.material_type === "video") ?? null;
  const quizMaterial =
    materials.find((material) => material.material_type === "quiz") ?? null;

  let quiz: LearnerLessonData["quiz"] = null;

  if (quizMaterial) {
    const { data: quizActivity, error: quizActivityError } = await supabase
      .from("activities")
      .select(`
        id,
        title,
        activity_questions (
          id,
          question_number,
          question_text,
          marks,
          display_order
        )
      `)
      .eq("lesson_material_id", quizMaterial.id)
      .maybeSingle();

    if (quizActivityError) throw new Error(quizActivityError.message);

    if (quizActivity) {
      quiz = {
        id: quizActivity.id,
        title: quizActivity.title,
        questions: [...(quizActivity.activity_questions ?? [])].sort(
          (questionA, questionB) =>
            (questionA.display_order ?? questionA.question_number) -
            (questionB.display_order ?? questionB.question_number),
        ),
      };
    }
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

export async function getLearnerActivityDataServer(
  activityId: string,
  subjectId: string,
): Promise<LearnerActivityWorkspaceResult> {
  await ensureLearnerSubjectAccess(subjectId);
  const supabase = await createSupabaseRequestClient();

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(
      "id, version, title, instructions, total_marks, due_date, lesson_material_id",
    )
    .eq("id", activityId)
    .maybeSingle();

  if (activityError) throw new Error(activityError.message);
  if (!activity) return { status: "not-found" };

  const [materialResult, questionsResult] = await Promise.all([
    supabase
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
      .maybeSingle(),
    supabase
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
      .order("question_number", { ascending: true }),
  ]);

  if (materialResult.error) throw new Error(materialResult.error.message);
  if (questionsResult.error) throw new Error(questionsResult.error.message);
  if (!materialResult.data) return { status: "missing-reading" };

  const material = materialResult.data as unknown as LinkedActivityMaterialRow;

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
      questions: questionsResult.data ?? [],
    },
  };
}

export async function getLearnerSavedActivitySubmissionServer(
  activityId: string,
  subjectId: string,
): Promise<LearnerSavedActivitySubmission | null> {
  const profile = await ensureLearnerSubjectAccess(subjectId);
  const supabase = await createSupabaseRequestClient();

  const { data, error } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      status,
      submitted_at,
      preliminary_mark,
      preliminary_total,
      preliminary_percentage,
      kingdom_marked_at,
      final_mark,
      reviewed_at,
      activity_snapshot,
      submitted_activity_version,
      original_total_marks,
      snapshot_created_at,
      activity_submission_answers (
        id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        kingdom_judgement,
        teacher_mark,
        teacher_feedback
      )
    `)
    .eq("learner_id", profile.userId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as LearnerSavedActivitySubmission | null) ?? null;
}
