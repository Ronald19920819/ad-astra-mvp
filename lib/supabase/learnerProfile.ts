import "server-only";

import type { User } from "@supabase/supabase-js";
import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import {
  getProfileInitials,
  resolveProfileIdentity,
} from "@/lib/profiles/profileIdentity";
import { learnerSubjectGrantsAccess } from "@/lib/subjects/subjectEnrollment";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

function metadataString(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

async function loadLearnerProfileForUser(
  user: User,
): Promise<AuthenticatedLearnerProfile | null> {
  const admin = createSupabaseAdminClient();
  let { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, first_name, surname, full_name, profile_image_url, role")
    .eq("auth_user_id", user.id)
    .eq("role", "learner")
    .maybeSingle();

  if (isMissingColumnError(profileError)) {
    const fallback = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("auth_user_id", user.id)
      .eq("role", "learner")
      .maybeSingle();
    profile = fallback.data as typeof profile;
    profileError = fallback.error;
  }

  if (profileError) throw profileError;
  if (!profile) return null;

  let { data: learnerProfile, error: learnerProfileError } = await admin
    .from("learner_profiles")
    .select("id, grade, school_name, status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (isMissingColumnError(learnerProfileError)) {
    const fallback = await admin
      .from("learner_profiles")
      .select("id, grade, status")
      .eq("profile_id", profile.id)
      .maybeSingle();
    learnerProfile = fallback.data as typeof learnerProfile;
    learnerProfileError = fallback.error;
  }

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile || learnerProfile.status !== "active") return null;

  let { data: enrolments, error: enrolmentError } = await admin
    .from("learner_subjects")
    .select("status, is_active, subject:subjects(id, name, slug)")
    .eq("learner_profile_id", learnerProfile.id);

  const hasApprovalColumns = !isMissingColumnError(enrolmentError);
  if (!hasApprovalColumns) {
    const fallback = await admin
      .from("learner_subjects")
      .select("subject:subjects(id, name, slug)")
      .eq("learner_profile_id", learnerProfile.id);
    enrolments = (fallback.data ?? []).map((enrolment) => ({
      ...enrolment,
      status: "approved",
      is_active: true,
    })) as typeof enrolments;
    enrolmentError = fallback.error;
  }

  if (enrolmentError) throw enrolmentError;

  const normalisedEnrolments = (enrolments ?? []).flatMap((enrolment) => {
    const subject = Array.isArray(enrolment.subject)
      ? enrolment.subject[0]
      : enrolment.subject;
    if (!subject) return [];
    return [{
      status: enrolment.status,
      isActive: enrolment.is_active,
      subject,
    }];
  });
  const approvedSubjects = normalisedEnrolments
    .filter(
      (enrolment) =>
        learnerSubjectGrantsAccess(enrolment.status, enrolment.isActive),
    )
    .map((enrolment) => enrolment.subject);
  const pendingSubjectRequests = normalisedEnrolments
    .filter((enrolment) => enrolment.status === "pending")
    .map((enrolment) => enrolment.subject);
  const declinedSubjectRequests = normalisedEnrolments
    .filter((enrolment) => enrolment.status === "declined")
    .map((enrolment) => enrolment.subject);
  const metadataFirstName = metadataString(user, [
    "first_name",
    "given_name",
  ]);
  const metadataSurname = metadataString(user, [
    "surname",
    "last_name",
    "family_name",
  ]);
  const metadataDisplayName = metadataString(user, ["full_name", "name"]);
  const databaseFirstName =
    "first_name" in profile && typeof profile.first_name === "string"
      ? profile.first_name.trim()
      : "";
  const databaseSurname =
    "surname" in profile && typeof profile.surname === "string"
      ? profile.surname.trim()
      : "";
  const identity = resolveProfileIdentity({
    databaseFirstName,
    databaseSurname,
    databaseDisplayName:
      typeof profile.full_name === "string" ? profile.full_name : null,
    metadataFirstName,
    metadataSurname,
    metadataDisplayName,
    email: user.email,
    roleFallback: "Learner",
  });
  const gradeStage =
    typeof learnerProfile.grade === "string" && learnerProfile.grade.trim()
      ? learnerProfile.grade.trim()
      : null;

  return {
    userId: user.id,
    profileId: profile.id,
    learnerProfileId: learnerProfile.id,
    firstName: identity.firstName,
    surname: identity.surname,
    fullName: identity.displayName,
    displayName: identity.displayName,
    initials: getProfileInitials(identity, ""),
    email: user.email ?? null,
    school:
      "school_name" in learnerProfile &&
      typeof learnerProfile.school_name === "string" &&
      learnerProfile.school_name.trim()
        ? learnerProfile.school_name.trim()
        : null,
    gradeStage,
    gradeOrStage: gradeStage,
    profileImageUrl:
      ("profile_image_url" in profile &&
      typeof profile.profile_image_url === "string" &&
      profile.profile_image_url.trim()
        ? profile.profile_image_url.trim()
        : null) ?? metadataString(user, ["avatar_url", "picture"]),
    role: "learner",
    accountStatus: learnerProfile.status,
    enrolledSubjectCount: approvedSubjects.length,
    approvedSubjects,
    pendingSubjects: pendingSubjectRequests,
    pendingSubjectRequests,
    declinedSubjects: declinedSubjectRequests,
    declinedSubjectRequests,
  };
}

export async function getAuthenticatedLearnerProfile() {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser();

  if (error || !user) return null;
  return loadLearnerProfileForUser(user);
}

export async function getLearnerProfileByAuthUserId(authUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(authUserId);

  if (error) throw error;
  if (!data.user) return null;
  return loadLearnerProfileForUser(data.user);
}
