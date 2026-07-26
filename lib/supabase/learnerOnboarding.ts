import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";

export type LearnerOnboardingSubjectStatus =
  | "approved"
  | "pending"
  | "declined"
  | "inactive"
  | null;

export type LearnerOnboardingState = {
  profile: {
    firstName: string;
    surname: string;
    displayName: string;
    email: string;
    school: string | null;
    gradeOrStage: string | null;
    isComplete: boolean;
  };
  subjects: {
    id: string;
    name: string;
    slug: string;
    status: LearnerOnboardingSubjectStatus;
  }[];
  hasAnySubjectRequest: boolean;
};

export async function getAuthenticatedLearnerOnboarding():
  Promise<LearnerOnboardingState | null> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();
  if (userError || !user?.email) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, first_name, surname, full_name, role")
    .eq("auth_user_id", user.id)
    .eq("role", "learner")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: learnerProfile, error: learnerProfileError } = await admin
    .from("learner_profiles")
    .select("id, school_name, grade, status")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (learnerProfileError) throw learnerProfileError;

  const enrolmentBySubjectId = new Map<
    string,
    { status: string; is_active: boolean }
  >();

  if (learnerProfile) {
    const { data: enrolments, error: enrolmentError } = await admin
      .from("learner_subjects")
      .select("subject_id, status, is_active")
      .eq("learner_profile_id", learnerProfile.id);
    if (enrolmentError) throw enrolmentError;

    for (const enrolment of enrolments ?? []) {
      enrolmentBySubjectId.set(enrolment.subject_id, enrolment);
    }
  }

  const firstName = profile.first_name?.trim() ?? "";
  const surname = profile.surname?.trim() ?? "";
  const displayName =
    [firstName, surname].filter(Boolean).join(" ") ||
    profile.full_name?.trim() ||
    user.email;
  const school = learnerProfile?.school_name?.trim() || null;
  const gradeOrStage = learnerProfile?.grade?.trim() || null;

  return {
    profile: {
      firstName,
      surname,
      displayName,
      email: user.email,
      school,
      gradeOrStage,
      isComplete:
        learnerProfile?.status === "active" &&
        Boolean(school) &&
        Boolean(gradeOrStage),
    },
    subjects: Object.values(subjectConfigurations).map((subject) => {
      const enrolment = enrolmentBySubjectId.get(subject.databaseId);
      let status: LearnerOnboardingSubjectStatus = null;

      if (enrolment?.status === "approved") {
        status = enrolment.is_active ? "approved" : "inactive";
      } else if (
        enrolment?.status === "pending" ||
        enrolment?.status === "declined"
      ) {
        status = enrolment.status;
      }

      return {
        id: subject.databaseId,
        name: subject.displayName,
        slug: subject.slug,
        status,
      };
    }),
    hasAnySubjectRequest: enrolmentBySubjectId.size > 0,
  };
}
