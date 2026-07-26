import "server-only";

import type { AuthenticatedTeacherProfile } from "@/lib/teachers/teacherProfile";
import {
  authorizeTeacher,
  type TeacherAuthorizationResult,
} from "@/lib/supabase/teacherAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type TeacherSubjectSummary = {
  learnerCount: number;
  pendingReviewCount: number;
  publishedLessonCount: number;
  publishedActivityCount: number;
};

function authorizationError(
  authorization: Exclude<TeacherAuthorizationResult, { success: true }>,
) {
  const error = new Error(authorization.error);
  error.name = authorization.code;
  return error;
}

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function getTeacherSubjectSummary(
  subjectId: string,
): Promise<TeacherSubjectSummary> {
  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) throw authorizationError(authorization);

  return getTeacherSubjectSummaryForTeacher(
    { teacherProfileId: authorization.teacher.teacherProfileId },
    subjectId,
  );
}

export async function getTeacherSubjectSummaryForTeacher(
  teacher:
    | AuthenticatedTeacherProfile
    | { teacherProfileId: string },
  subjectId: string,
): Promise<TeacherSubjectSummary> {
  const admin = createSupabaseAdminClient();
  const teacherProfileId = teacher.teacherProfileId;
  const hasAssignedSubjectList =
    "assignedSubjects" in teacher && Array.isArray(teacher.assignedSubjects);

  if (hasAssignedSubjectList) {
    const hasSubjectAccess = teacher.assignedSubjects.some(
      (subject) => subject.id === subjectId,
    );
    if (!hasSubjectAccess) {
      throw authorizationError({
        success: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Teacher access to this subject is required.",
      });
    }
  } else {
    const { data: assignment, error: assignmentError } = await admin
      .from("teacher_subjects")
      .select("id")
      .eq("teacher_profile_id", teacherProfileId)
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .maybeSingle();

    if (isMissingColumnError(assignmentError)) {
      const fallback = await admin
        .from("teacher_subjects")
        .select("id")
        .eq("teacher_profile_id", teacherProfileId)
        .eq("subject_id", subjectId)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      if (!fallback.data) {
        throw authorizationError({
          success: false,
          status: 403,
          code: "FORBIDDEN",
          error: "Teacher access to this subject is required.",
        });
      }
    } else if (assignmentError) {
      throw assignmentError;
    } else if (!assignment) {
      throw authorizationError({
        success: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Teacher access to this subject is required.",
      });
    }
  }

  const [initialLearnerResult, lessonResult] = await Promise.all([
    admin
      .from("learner_subjects")
      .select("subject_id", { count: "exact", head: true })
      .eq("subject_id", subjectId)
      .eq("status", "approved")
      .eq("is_active", true),
    admin
      .from("lessons")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("status", "published"),
  ]);
  let learnerResult = initialLearnerResult;

  if (isMissingColumnError(learnerResult.error)) {
    learnerResult = await admin
      .from("learner_subjects")
      .select("subject_id", { count: "exact", head: true })
      .eq("subject_id", subjectId);
  }

  if (learnerResult.error) throw learnerResult.error;
  if (lessonResult.error) throw lessonResult.error;

  const lessonIds = (lessonResult.data ?? []).map((lesson) => lesson.id);
  if (lessonIds.length === 0) {
    return {
      learnerCount: learnerResult.count ?? 0,
      pendingReviewCount: 0,
      publishedLessonCount: 0,
      publishedActivityCount: 0,
    };
  }

  const { data: materials, error: materialsError } = await admin
    .from("lesson_materials")
    .select("id, material_type")
    .in("lesson_id", lessonIds);
  if (materialsError) throw materialsError;

  const activityMaterialIds = (materials ?? [])
    .filter((material) => material.material_type !== "quiz")
    .map((material) => material.id);
  if (activityMaterialIds.length === 0) {
    return {
      learnerCount: learnerResult.count ?? 0,
      pendingReviewCount: 0,
      publishedLessonCount: lessonIds.length,
      publishedActivityCount: 0,
    };
  }

  const { data: activities, error: activitiesError } = await admin
    .from("activities")
    .select("id")
    .in("lesson_material_id", activityMaterialIds);
  if (activitiesError) throw activitiesError;

  const activityIds = (activities ?? []).map((activity) => activity.id);
  let pendingReviewCount = 0;
  if (activityIds.length > 0) {
    const { count, error } = await admin
      .from("activity_submissions")
      .select("id", { count: "exact", head: true })
      .in("activity_id", activityIds)
      .in("status", ["submitted", "marking_failed", "awaiting_review"]);
    if (error) throw error;
    pendingReviewCount = count ?? 0;
  }

  return {
    learnerCount: learnerResult.count ?? 0,
    pendingReviewCount,
    publishedLessonCount: lessonIds.length,
    publishedActivityCount: activityIds.length,
  };
}
