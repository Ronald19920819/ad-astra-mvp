import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import {
  destinationForAccountRole,
  isAccountRole,
} from "@/lib/auth/accountRole";
import { learnerOnboardingDestination } from "@/lib/learners/onboarding";

export async function POST() {
  try {
    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "Sign-in is required.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      await requestClient.auth.signOut();
      return Response.json(
        { error: "Profile not found.", code: "PROFILE_NOT_FOUND" },
        { status: 403 },
      );
    }

    if (!isAccountRole(profile.role)) {
      await requestClient.auth.signOut();
      return Response.json(
        {
          error: "This account does not have an authorised role.",
          code: "INVALID_ROLE",
        },
        { status: 403 },
      );
    }

    if (profile.role === "teacher") {
      const { data: teacherProfile, error: teacherError } = await admin
        .from("teacher_profiles")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) throw teacherError;
      if (!teacherProfile) {
        await requestClient.auth.signOut();
        return Response.json(
          { error: "Teacher account is inactive.", code: "INACTIVE_TEACHER" },
          { status: 403 },
        );
      }
    } else {
      const { data: learnerProfile, error: learnerError } = await admin
        .from("learner_profiles")
        .select("id, school_name, grade, status")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (learnerError) throw learnerError;
      if (learnerProfile && learnerProfile.status !== "active") {
        await requestClient.auth.signOut();
        return Response.json(
          { error: "Learner account is inactive.", code: "INACTIVE_LEARNER" },
          { status: 403 },
        );
      }

      if (
        !learnerProfile ||
        !learnerProfile.school_name?.trim() ||
        !learnerProfile.grade?.trim()
      ) {
        return Response.json({
          success: true,
          actualRole: profile.role,
          destination: learnerOnboardingDestination({
            hasLearnerProfile: Boolean(learnerProfile),
            profileComplete: false,
            hasAnySubjectRequest: false,
          }),
        });
      }

      const { count: subjectRequestCount, error: subjectRequestError } =
        await admin
          .from("learner_subjects")
          .select("id", { count: "exact", head: true })
          .eq("learner_profile_id", learnerProfile.id);
      if (subjectRequestError) throw subjectRequestError;

      if ((subjectRequestCount ?? 0) === 0) {
        return Response.json({
          success: true,
          actualRole: profile.role,
          destination: learnerOnboardingDestination({
            hasLearnerProfile: true,
            profileComplete: true,
            hasAnySubjectRequest: false,
          }),
        });
      }
    }

    return Response.json({
      success: true,
      actualRole: profile.role,
      destination: destinationForAccountRole(profile.role),
    });
  } catch (error) {
    console.error("AD Astra session verification failed:", error);
    return Response.json(
      { error: "Sign-in could not be verified.", code: "VERIFY_FAILED" },
      { status: 500 },
    );
  }
}
