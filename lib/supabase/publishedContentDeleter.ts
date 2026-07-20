import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";

export type PublishedContentDeleteResult =
  | { success: true }
  | {
      success: false;
      status: number;
      code: string;
      error: string;
    };

type LessonMaterialReference = {
  id: string;
  material_type: string;
};

function failure(
  status: number,
  code: string,
  error: string,
): PublishedContentDeleteResult {
  return { success: false, status, code, error };
}

async function authorizeBusinessStudiesTeacher(): Promise<
  PublishedContentDeleteResult | { success: true; admin: ReturnType<typeof createSupabaseAdminClient> }
> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return failure(401, "UNAUTHORIZED", "Teacher sign-in is required.");
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return failure(403, "FORBIDDEN", "Teacher access is required.");
  }

  const { data: teacherProfile, error: teacherProfileError } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (teacherProfileError) throw teacherProfileError;
  if (!teacherProfile) {
    return failure(403, "FORBIDDEN", "Active teacher access is required.");
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("teacher_subjects")
    .select("id")
    .eq("teacher_profile_id", teacherProfile.id)
    .eq("subject_id", businessStudiesSubjectId)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) {
    return failure(
      403,
      "FORBIDDEN",
      "Business Studies teacher access is required.",
    );
  }

  return { success: true, admin };
}

function isMissingOptionalTable(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("Could not find the table") === true
  );
}

async function countOptionalLessonDependencies(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: "learner_quiz_attempts" | "learner_lesson_completions",
  lessonId: string,
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);

  if (error) {
    if (isMissingOptionalTable(error)) return 0;
    throw error;
  }

  return count ?? 0;
}

export async function deletePublishedBusinessStudiesActivity(
  activityId: string,
): Promise<PublishedContentDeleteResult> {
  const authorization = await authorizeBusinessStudiesTeacher();
  if (!("admin" in authorization)) return authorization;

  const { admin } = authorization;
  const { data: activity, error: activityError } = await admin
    .from("activities")
    .select("id, lesson_material_id")
    .eq("id", activityId)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activity) {
    return failure(404, "NOT_FOUND", "The activity could not be found.");
  }

  const { data: material, error: materialError } = await admin
    .from("lesson_materials")
    .select("lesson_id, material_type")
    .eq("id", activity.lesson_material_id)
    .maybeSingle();

  if (materialError) throw materialError;
  if (!material) {
    return failure(404, "NOT_FOUND", "The linked lesson could not be found.");
  }

  if (!["activity", "reading"].includes(material.material_type)) {
    return failure(
      404,
      "NOT_FOUND",
      "The published Business Studies activity could not be found.",
    );
  }

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, subject_id, status")
    .eq("id", material.lesson_id)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (
    !lesson ||
    lesson.subject_id !== businessStudiesSubjectId ||
    lesson.status !== "published"
  ) {
    return failure(
      404,
      "NOT_FOUND",
      "The published Business Studies activity could not be found.",
    );
  }

  const { count: submissionCount, error: submissionCountError } = await admin
    .from("activity_submissions")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId);

  if (submissionCountError && !isMissingOptionalTable(submissionCountError)) {
    throw submissionCountError;
  }

  if ((submissionCount ?? 0) > 0) {
    return failure(
      409,
      "DEPENDENCIES_EXIST",
      "This activity cannot be deleted because learner submissions or results are linked to it.",
    );
  }

  const { error: questionsError } = await admin
    .from("activity_questions")
    .delete()
    .eq("activity_id", activityId);

  if (questionsError) throw questionsError;

  const { data: deletedActivity, error: deleteError } = await admin
    .from("activities")
    .delete()
    .eq("id", activityId)
    .select("id")
    .maybeSingle();

  if (deleteError) throw deleteError;
  if (!deletedActivity) {
    throw new Error("The activity delete did not remove a record.");
  }

  return { success: true };
}

export async function deletePublishedBusinessStudiesLesson(
  lessonId: string,
): Promise<PublishedContentDeleteResult> {
  const authorization = await authorizeBusinessStudiesTeacher();
  if (!("admin" in authorization)) return authorization;

  const { admin } = authorization;
  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .eq("subject_id", businessStudiesSubjectId)
    .eq("status", "published")
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (!lesson) {
    return failure(
      404,
      "NOT_FOUND",
      "The published Business Studies lesson could not be found.",
    );
  }

  const [quizAttemptCount, completionCount] = await Promise.all([
    countOptionalLessonDependencies(admin, "learner_quiz_attempts", lessonId),
    countOptionalLessonDependencies(
      admin,
      "learner_lesson_completions",
      lessonId,
    ),
  ]);

  if (quizAttemptCount > 0 || completionCount > 0) {
    return failure(
      409,
      "DEPENDENCIES_EXIST",
      "This lesson cannot be deleted because learner progress or quiz attempts are linked to it.",
    );
  }

  const { data: materials, error: materialsError } = await admin
    .from("lesson_materials")
    .select("id, material_type")
    .eq("lesson_id", lessonId);

  if (materialsError) throw materialsError;

  const materialRows = (materials ?? []) as LessonMaterialReference[];
  const materialIds = materialRows.map((material) => material.id);
  const materialTypes = new Map(
    materialRows.map((material) => [material.id, material.material_type]),
  );
  let linkedActivities: { id: string; lesson_material_id: string }[] = [];

  if (materialIds.length > 0) {
    const { data, error } = await admin
      .from("activities")
      .select("id, lesson_material_id")
      .in("lesson_material_id", materialIds);

    if (error) throw error;
    linkedActivities = data ?? [];
  }

  const publishedActivities = linkedActivities.filter(
    (activity) => materialTypes.get(activity.lesson_material_id) !== "quiz",
  );

  if (publishedActivities.length > 0) {
    return failure(
      409,
      "DEPENDENCIES_EXIST",
      "This lesson cannot be deleted because a published activity is linked to it. Delete the activity separately first.",
    );
  }

  const lessonQuizActivityIds = linkedActivities
    .filter(
      (activity) => materialTypes.get(activity.lesson_material_id) === "quiz",
    )
    .map((activity) => activity.id);

  if (lessonQuizActivityIds.length > 0) {
    const { error: questionDeleteError } = await admin
      .from("activity_questions")
      .delete()
      .in("activity_id", lessonQuizActivityIds);

    if (questionDeleteError) throw questionDeleteError;

    const { error: quizActivityDeleteError } = await admin
      .from("activities")
      .delete()
      .in("id", lessonQuizActivityIds);

    if (quizActivityDeleteError) throw quizActivityDeleteError;
  }

  if (materialIds.length > 0) {
    const { error: materialDeleteError } = await admin
      .from("lesson_materials")
      .delete()
      .eq("lesson_id", lessonId);

    if (materialDeleteError) throw materialDeleteError;
  }

  const { data: deletedLesson, error: lessonDeleteError } = await admin
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("subject_id", businessStudiesSubjectId)
    .eq("status", "published")
    .select("id")
    .maybeSingle();

  if (lessonDeleteError) throw lessonDeleteError;
  if (!deletedLesson) {
    throw new Error("The lesson delete did not remove a record.");
  }

  return { success: true };
}
