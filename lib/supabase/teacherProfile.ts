import "server-only";

import type { User } from "@supabase/supabase-js";
import { resolveProfileIdentity } from "@/lib/profiles/profileIdentity";
import type {
  AuthenticatedTeacherProfile,
  TeacherProfileDashboard,
  TeacherTeachingOverview,
} from "@/lib/teachers/teacherProfile";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { logAuthDiagnostic } from "@/lib/observability/authDiagnostics";

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function metadataString(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// AD Astra Dashboard Reliability -- Teacher Teaching Overview RPC
// (supabase/migrations/202609150001_teacher_teaching_overview_rpc.sql):
// this previously fetched entire lessonIds -> materialIds -> activityIds
// arrays and passed each into the next query's .in() filter -- a manual
// application-side join that, for a teacher/school with enough
// accumulated content, produced a real ~15,851-character PostgREST
// request URL and UND_ERR_HEADERS_OVERFLOW in production. Every value
// this function returns is a plain count, never a list, so none of those
// enumerated ids were ever actually needed by the caller -- the
// aggregation now happens server-side, in one request, with real SQL
// joins and COUNT/COUNT DISTINCT. No UUID array of any size is
// constructed here again. p_teacher_profile_id is the only input, and is
// always this already-authenticated caller's own resolved
// profile.teacherProfileId -- never client-supplied -- matching the RPC's
// service_role-only execute grant (see the migration's own header
// comment for the full security rationale).
type TeacherTeachingOverviewRpcRow = {
  subjects_taught: number;
  active_learners: number;
  published_lessons: number;
  published_activities: number;
  submissions_awaiting_review: number;
};

export async function getTeacherTeachingOverview(
  profile: AuthenticatedTeacherProfile,
): Promise<TeacherTeachingOverview> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .rpc("get_teacher_teaching_overview", {
      p_teacher_profile_id: profile.teacherProfileId,
    })
    .single();

  if (error) throw error;
  const row = data as TeacherTeachingOverviewRpcRow;

  return {
    subjectsTaught: row.subjects_taught,
    activeLearners: row.active_learners,
    publishedLessons: row.published_lessons,
    publishedActivities: row.published_activities,
    submissionsAwaitingReview: row.submissions_awaiting_review,
  };
}

async function loadTeacherProfileForUser(
  user: User,
): Promise<AuthenticatedTeacherProfile | null> {
  const admin = createSupabaseAdminClient();
  let { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, first_name, surname, full_name, profile_image_url, role")
    .eq("auth_user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();

  if (isMissingColumnError(profileError)) {
    const fallback = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("auth_user_id", user.id)
      .eq("role", "teacher")
      .maybeSingle();
    profile = fallback.data as typeof profile;
    profileError = fallback.error;
  }
  if (profileError) {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.profile",
      "profile_lookup_failed",
      profileError,
    );
    throw profileError;
  }
  if (!profile) {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.profile",
      "profile_not_found",
    );
    return null;
  }

  let { data: teacherProfile, error: teacherProfileError } = await admin
    .from("teacher_profiles")
    .select("id, faculty_name, school_name, is_administrator, status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (isMissingColumnError(teacherProfileError)) {
    const fallback = await admin
      .from("teacher_profiles")
      .select("id, faculty_name, status")
      .eq("profile_id", profile.id)
      .maybeSingle();
    teacherProfile = fallback.data as typeof teacherProfile;
    teacherProfileError = fallback.error;
  }
  if (teacherProfileError) {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.teacher-profile",
      "teacher_profile_lookup_failed",
      teacherProfileError,
    );
    throw teacherProfileError;
  }
  if (!teacherProfile || teacherProfile.status !== "active") {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.teacher-profile",
      !teacherProfile ? "teacher_profile_not_found" : "teacher_profile_inactive",
    );
    return null;
  }

  let { data: assignments, error: assignmentError } = await admin
    .from("teacher_subjects")
    .select("status, subject:subjects(id, name, slug)")
    .eq("teacher_profile_id", teacherProfile.id)
    .eq("status", "active");
  if (isMissingColumnError(assignmentError)) {
    const fallback = await admin
      .from("teacher_subjects")
      .select("subject:subjects(id, name, slug)")
      .eq("teacher_profile_id", teacherProfile.id);
    assignments = (fallback.data ?? []).map((assignment) => ({
      ...assignment,
      status: "active",
    })) as typeof assignments;
    assignmentError = fallback.error;
  }
  if (assignmentError) {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.subject-assignment",
      "subject_assignment_lookup_failed",
      assignmentError,
    );
    throw assignmentError;
  }

  const assignedSubjects = (assignments ?? []).flatMap((assignment) => {
    const subject = Array.isArray(assignment.subject)
      ? assignment.subject[0]
      : assignment.subject;
    return subject ? [subject] : [];
  });
  const databaseFirstName =
    "first_name" in profile && typeof profile.first_name === "string"
      ? profile.first_name.trim()
      : "";
  const databaseSurname =
    "surname" in profile && typeof profile.surname === "string"
      ? profile.surname.trim()
      : "";
  const metadataFirstName = metadataString(user, ["first_name", "given_name"]);
  const metadataSurname = metadataString(user, [
    "surname",
    "last_name",
    "family_name",
  ]);
  const identity = resolveProfileIdentity({
    databaseFirstName,
    databaseSurname,
    databaseDisplayName:
      typeof profile.full_name === "string" ? profile.full_name : null,
    metadataFirstName,
    metadataSurname,
    metadataDisplayName: metadataString(user, ["full_name", "name"]),
    email: user.email,
    roleFallback: "Teacher",
  });

  return {
    userId: user.id,
    profileId: profile.id,
    teacherProfileId: teacherProfile.id,
    firstName: identity.firstName,
    surname: identity.surname,
    displayName: identity.displayName,
    email: user.email ?? null,
    school:
      "school_name" in teacherProfile &&
      typeof teacherProfile.school_name === "string" &&
      teacherProfile.school_name.trim()
        ? teacherProfile.school_name.trim()
        : null,
    profileImageUrl:
      ("profile_image_url" in profile &&
      typeof profile.profile_image_url === "string" &&
      profile.profile_image_url.trim()
        ? profile.profile_image_url.trim()
        : null) ?? metadataString(user, ["avatar_url", "picture"]),
    role: "teacher",
    isAdministrator:
      "is_administrator" in teacherProfile &&
      teacherProfile.is_administrator === true,
    accountStatus: teacherProfile.status,
    facultyName:
      typeof teacherProfile.faculty_name === "string" &&
      teacherProfile.faculty_name.trim()
        ? teacherProfile.faculty_name.trim()
        : null,
    assignedSubjects,
  };
}

export async function getAuthenticatedTeacherProfile() {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser();

  // A missing user with no error is the ordinary "not signed in" case and
  // is not logged. An actual error here (as opposed to simply no
  // session) is what previously surfaced to teachers as an unexplained
  // "Unable to load the current subject summary." -- logging its safe
  // fields (never the token/cookie itself) with a requestId + stage lets
  // a future occurrence be correlated against the same request's
  // proxy-stage log line and distinguished from a genuine query failure.
  if (error) {
    await logAuthDiagnostic(
      "Teacher auth resolution failed:",
      "teacher-page.auth",
      "auth_get_user_failed",
      error,
    );
  }
  if (error || !user) return null;

  return loadTeacherProfileForUser(user);
}

// AD Astra Dashboard Reliability -- profile/overview failure isolation:
// a teaching-overview failure (network, RPC, or otherwise) must never
// discard an already-resolved, healthy teacher identity. Previously this
// function awaited getTeacherTeachingOverview() directly, so any failure
// there rejected the whole call -- callers (app/teacher/page.tsx,
// /api/teacher/profile) then treated a perfectly good profile resolution
// as if it had failed too, showing a generic "Teacher"/all-zero fallback
// instead of the teacher's real name/school. The teaching-overview call
// is now isolated in its own try/catch: on failure it is logged (safe
// fields only, via the shared requestId-correlated logAuthDiagnostic
// helper) and degrades to the same all-zero TeacherTeachingOverview shape
// already used elsewhere as an initial/failure fallback -- the returned
// profile itself is always the real, successfully resolved one.
export async function getAuthenticatedTeacherProfileDashboard():
  Promise<TeacherProfileDashboard | null> {
  const profile = await getAuthenticatedTeacherProfile();
  if (!profile) return null;

  let teachingOverview: TeacherTeachingOverview = {
    subjectsTaught: 0,
    activeLearners: 0,
    publishedLessons: 0,
    publishedActivities: 0,
    submissionsAwaitingReview: 0,
  };
  try {
    teachingOverview = await getTeacherTeachingOverview(profile);
  } catch (error) {
    await logAuthDiagnostic(
      "Teacher dashboard teaching overview failed:",
      "teacher-page.teaching-overview",
      "teaching_overview_failed",
      error,
    );
  }

  return {
    profile,
    teachingOverview,
  };
}
