import "server-only";

import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSubjectConfigurationByDatabaseId,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";

export type LearnerSubjectAccess =
  | {
      allowed: true;
      learnerProfileId: string;
      subjectKey: SubjectKey;
    }
  | {
      allowed: false;
      reason:
        | "invalid-subject"
        | "learner-profile-not-found"
        | "subject-not-enrolled";
    };

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function verifyLearnerSubjectAccess(
  authUserId: string,
  subjectId: string,
): Promise<LearnerSubjectAccess> {
  const currentLearner = await getAuthenticatedLearnerProfile();
  if (currentLearner && currentLearner.userId === authUserId) {
    return verifyLearnerSubjectAccessForProfile(currentLearner, subjectId);
  }

  const subject = getSubjectConfigurationByDatabaseId(subjectId);
  if (!subject) return { allowed: false, reason: "invalid-subject" };

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return { allowed: false, reason: "learner-profile-not-found" };
  }

  const { data: learnerProfile, error: learnerProfileError } = await admin
    .from("learner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) {
    return { allowed: false, reason: "learner-profile-not-found" };
  }

  let { data: enrolment, error: enrolmentError } = await admin
    .from("learner_subjects")
    .select("subject_id")
    .eq("learner_profile_id", learnerProfile.id)
    .eq("subject_id", subjectId)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle();

  if (isMissingColumnError(enrolmentError)) {
    const fallback = await admin
      .from("learner_subjects")
      .select("subject_id")
      .eq("learner_profile_id", learnerProfile.id)
      .eq("subject_id", subjectId)
      .maybeSingle();
    enrolment = fallback.data;
    enrolmentError = fallback.error;
  }

  if (enrolmentError) throw enrolmentError;
  if (!enrolment) {
    return { allowed: false, reason: "subject-not-enrolled" };
  }

  return {
    allowed: true,
    learnerProfileId: learnerProfile.id,
    subjectKey: subject.key,
  };
}

export function verifyLearnerSubjectAccessForProfile(
  profile: Pick<
    AuthenticatedLearnerProfile,
    "learnerProfileId" | "approvedSubjects"
  >,
  subjectId: string,
): LearnerSubjectAccess {
  const subject = getSubjectConfigurationByDatabaseId(subjectId);
  if (!subject) return { allowed: false, reason: "invalid-subject" };

  const hasSubjectAccess = profile.approvedSubjects.some(
    (approvedSubject) => approvedSubject.id === subjectId,
  );

  if (!hasSubjectAccess) {
    return { allowed: false, reason: "subject-not-enrolled" };
  }

  return {
    allowed: true,
    learnerProfileId: profile.learnerProfileId,
    subjectKey: subject.key,
  };
}

export async function getLearnerSubjectKeys(authUserId: string) {
  const currentLearner = await getAuthenticatedLearnerProfile();
  if (currentLearner && currentLearner.userId === authUserId) {
    return getLearnerSubjectKeysForProfile(currentLearner);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return [];

  const { data: learnerProfile, error: learnerProfileError } = await admin
    .from("learner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) return [];

  let { data: enrolments, error: enrolmentError } = await admin
    .from("learner_subjects")
    .select("subject_id")
    .eq("learner_profile_id", learnerProfile.id)
    .eq("status", "approved")
    .eq("is_active", true);

  if (isMissingColumnError(enrolmentError)) {
    const fallback = await admin
      .from("learner_subjects")
      .select("subject_id")
      .eq("learner_profile_id", learnerProfile.id);
    enrolments = fallback.data;
    enrolmentError = fallback.error;
  }

  if (enrolmentError) throw enrolmentError;

  return (enrolments ?? [])
    .map((enrolment) =>
      getSubjectConfigurationByDatabaseId(enrolment.subject_id),
    )
    .filter((subject): subject is NonNullable<typeof subject> =>
      Boolean(subject),
    )
    .map((subject) => subject.key);
}

export function getLearnerSubjectKeysForProfile(
  profile: Pick<AuthenticatedLearnerProfile, "approvedSubjects">,
) {
  return profile.approvedSubjects
    .map((subject) => getSubjectConfigurationByDatabaseId(subject.id))
    .filter((subject): subject is NonNullable<typeof subject> =>
      Boolean(subject),
    )
    .map((subject) => subject.key);
}
