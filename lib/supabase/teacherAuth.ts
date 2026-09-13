import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { businessStudiesSubject } from "@/lib/subjects/subjectConfig";
import { logAuthDiagnostic } from "@/lib/observability/authDiagnostics";

export const businessStudiesSubjectId =
  businessStudiesSubject.databaseId;

export type AuthorizedTeacher = {
  userId: string;
  profileId: string;
  teacherProfileId: string;
  isAdministrator: boolean;
  admin: ReturnType<typeof createSupabaseAdminClient>;
};

export type TeacherAuthorizationResult =
  | { success: true; teacher: AuthorizedTeacher }
  | {
      success: false;
      status: number;
      code: string;
      error: string;
    };

function failure(
  status: number,
  code: string,
  error: string,
): TeacherAuthorizationResult {
  return { success: false, status, code, error };
}

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function authorizeTeacher(
  subjectId?: string,
): Promise<TeacherAuthorizationResult> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  // As in getAuthenticatedTeacherProfile: a bare missing user is the
  // routine "not signed in" case, but an actual error is worth
  // distinguishing in logs from a plain 401 so a genuine session-refresh
  // failure doesn't look identical to an ordinary unauthenticated request.
  if (userError) {
    await logAuthDiagnostic(
      "Teacher authorization failed:",
      "teacher-page.auth",
      "auth_get_user_failed",
      userError,
    );
  }
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

  if (profileError) {
    await logAuthDiagnostic(
      "Teacher authorization failed:",
      "teacher-page.profile",
      "profile_lookup_failed",
      profileError,
    );
    throw profileError;
  }
  if (!profile) {
    await logAuthDiagnostic(
      "Teacher authorization failed:",
      "teacher-page.profile",
      "profile_not_found",
    );
    return failure(403, "FORBIDDEN", "Teacher access is required.");
  }

  const { data: teacherProfile, error: teacherProfileError } = await admin
    .from("teacher_profiles")
    .select("id, is_administrator")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (teacherProfileError) {
    await logAuthDiagnostic(
      "Teacher authorization failed:",
      "teacher-page.teacher-profile",
      "teacher_profile_lookup_failed",
      teacherProfileError,
    );
    throw teacherProfileError;
  }
  if (!teacherProfile) {
    await logAuthDiagnostic(
      "Teacher authorization failed:",
      "teacher-page.teacher-profile",
      "active_teacher_profile_not_found",
    );
    return failure(403, "FORBIDDEN", "Active teacher access is required.");
  }

  if (subjectId) {
    let { data: assignment, error: assignmentError } = await admin
      .from("teacher_subjects")
      .select("id")
      .eq("teacher_profile_id", teacherProfile.id)
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .maybeSingle();

    if (isMissingColumnError(assignmentError)) {
      const fallback = await admin
        .from("teacher_subjects")
        .select("id")
        .eq("teacher_profile_id", teacherProfile.id)
        .eq("subject_id", subjectId)
        .maybeSingle();
      assignment = fallback.data;
      assignmentError = fallback.error;
    }

    if (assignmentError) {
      await logAuthDiagnostic(
        "Teacher authorization failed:",
        "teacher-page.subject-assignment",
        "subject_assignment_lookup_failed",
        assignmentError,
      );
      throw assignmentError;
    }
    if (!assignment) {
      await logAuthDiagnostic(
        "Teacher authorization failed:",
        "teacher-page.subject-assignment",
        "subject_not_assigned",
      );
      return failure(
        403,
        "FORBIDDEN",
        "Teacher access to this subject is required.",
      );
    }
  }

  return {
    success: true,
    teacher: {
      userId: user.id,
      profileId: profile.id,
      teacherProfileId: teacherProfile.id,
      isAdministrator: teacherProfile.is_administrator === true,
      admin,
    },
  };
}

export async function authorizeAdministrator():
  Promise<TeacherAuthorizationResult> {
  const authorization = await authorizeTeacher();
  if (!authorization.success) return authorization;

  if (!authorization.teacher.isAdministrator) {
    return failure(
      403,
      "ADMINISTRATOR_REQUIRED",
      "Administrator access is required.",
    );
  }

  return authorization;
}

export function teacherAuthorizationResponse(
  result: Exclude<TeacherAuthorizationResult, { success: true }>,
) {
  return Response.json(
    { error: result.error, code: result.code },
    { status: result.status },
  );
}
