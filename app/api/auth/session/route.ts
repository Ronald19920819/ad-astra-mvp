import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import {
  destinationForAccountRole,
  isAccountRole,
} from "@/lib/auth/accountRole";
import { learnerOnboardingDestination } from "@/lib/learners/onboarding";
import { logAuthDiagnostic } from "@/lib/observability/authDiagnostics";

export async function POST() {
  // Diagnostics only: tracks which step of session verification was in
  // flight when an error reached the catch-all below, so a production
  // "Sign in could not be completed" failure can be correlated (via
  // requestId, in logAuthDiagnostic) with the exact internal stage --
  // never read for any authentication/authorization decision.
  let stage = "auth-user";
  try {
    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    // As in authorizeTeacher/getAuthenticatedTeacherProfile: a bare
    // missing user is the ordinary "not signed in" case and stays
    // silent; an actual error here is a genuine session-resolution
    // failure worth distinguishing in logs, since it can surface to a
    // teacher as this same generic "Sign in could not be completed."
    if (userError) {
      await logAuthDiagnostic(
        "AD Astra session verification failed:",
        "auth-session.auth-user",
        "auth_get_user_failed",
        userError,
      );
    }
    if (userError || !user) {
      return Response.json(
        { error: "Sign-in is required.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const admin = createSupabaseAdminClient();
    stage = "profile-lookup";
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

    stage = "role-validation";
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
      stage = "teacher-profile";
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
      stage = "learner-profile";
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

      stage = "learner-subjects";
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
    await logAuthDiagnostic(
      "AD Astra session verification failed:",
      `auth-session.${stage}`,
      "verification_failed",
      error,
    );
    return Response.json(
      { error: "Sign-in could not be verified.", code: "VERIFY_FAILED" },
      { status: 500 },
    );
  }
}
