import "server-only";

import type { User } from "@supabase/supabase-js";
import { resolveProfileIdentity } from "@/lib/profiles/profileIdentity";
import type {
  AuthenticatedTeacherProfile,
  TeacherProfileDashboard,
  TeacherTeachingOverview,
} from "@/lib/teachers/teacherProfile";
import { countDistinctActiveLearners } from "@/lib/teachers/teacherProfile";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

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

export async function getTeacherTeachingOverview(
  profile: AuthenticatedTeacherProfile,
): Promise<TeacherTeachingOverview> {
  const admin = createSupabaseAdminClient();
  const subjectIds = profile.assignedSubjects.map((subject) => subject.id);
  if (subjectIds.length === 0) {
    return {
      subjectsTaught: 0,
      activeLearners: 0,
      publishedLessons: 0,
      publishedActivities: 0,
      submissionsAwaitingReview: 0,
    };
  }

  let learnerResult = await admin
    .from("learner_subjects")
    .select("learner_profile_id")
    .in("subject_id", subjectIds)
    .eq("status", "approved")
    .eq("is_active", true);
  if (isMissingColumnError(learnerResult.error)) {
    learnerResult = await admin
      .from("learner_subjects")
      .select("learner_profile_id")
      .in("subject_id", subjectIds);
  }

  const lessonResult = await admin
    .from("lessons")
    .select("id")
    .in("subject_id", subjectIds)
    .eq("status", "published");

  if (learnerResult.error) throw learnerResult.error;
  if (lessonResult.error) throw lessonResult.error;

  const activeLearners = countDistinctActiveLearners(
    (learnerResult.data ?? []).map((row) => row.learner_profile_id),
  );
  const lessonIds = (lessonResult.data ?? []).map((lesson) => lesson.id);
  if (lessonIds.length === 0) {
    return {
      subjectsTaught: subjectIds.length,
      activeLearners,
      publishedLessons: 0,
      publishedActivities: 0,
      submissionsAwaitingReview: 0,
    };
  }

  const { data: materials, error: materialError } = await admin
    .from("lesson_materials")
    .select("id")
    .in("lesson_id", lessonIds);
  if (materialError) throw materialError;

  const materialIds = (materials ?? []).map((material) => material.id);
  let activityIds: string[] = [];
  if (materialIds.length > 0) {
    const { data: activities, error: activityError } = await admin
      .from("activities")
      .select("id")
      .in("lesson_material_id", materialIds);
    if (activityError) throw activityError;
    activityIds = (activities ?? []).map((activity) => activity.id);
  }

  let submissionsAwaitingReview = 0;
  if (activityIds.length > 0) {
    const { count, error } = await admin
      .from("activity_submissions")
      .select("id", { count: "exact", head: true })
      .in("activity_id", activityIds)
      .in("status", ["submitted", "marking_failed", "awaiting_review"]);
    if (error) throw error;
    submissionsAwaitingReview = count ?? 0;
  }

  return {
    subjectsTaught: subjectIds.length,
    activeLearners,
    publishedLessons: lessonIds.length,
    publishedActivities: activityIds.length,
    submissionsAwaitingReview,
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
  if (profileError) throw profileError;
  if (!profile) return null;

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
  if (teacherProfileError) throw teacherProfileError;
  if (!teacherProfile || teacherProfile.status !== "active") return null;

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
  if (assignmentError) throw assignmentError;

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
  if (error || !user) return null;

  return loadTeacherProfileForUser(user);
}

export async function getAuthenticatedTeacherProfileDashboard():
  Promise<TeacherProfileDashboard | null> {
  const profile = await getAuthenticatedTeacherProfile();
  if (!profile) return null;

  return {
    profile,
    teachingOverview: await getTeacherTeachingOverview(profile),
  };
}
