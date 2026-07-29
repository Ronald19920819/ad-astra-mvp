import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

const teacherRoutePrefixes = ["/teacher"] as const;
const administratorRoutePrefixes = ["/administrator"] as const;
const learnerRoutePrefixes = [
  "/onboarding",
  "/home",
  "/subjects",
  "/activities",
  "/afrikaans-activities",
  "/afrikaans-classroom",
  "/afrikaans-dashboard",
  "/business-studies-activities",
  "/business-studies-classroom",
  "/business-studies-dashboard",
  "/english-activities",
  "/english-classroom",
  "/english-dashboard",
  "/history-activities",
  "/history-classroom",
  "/history-dashboard",
  "/chat",
  "/profile",
  "/schedule",
  "/tutor",
  "/your-work",
] as const;
const learnerSubjectRouteRequirements = [
  {
    familyKey: "business-studies",
    canonicalSubjectId: "c472f3c9-0e6f-40de-a748-3ad9400ac069",
    prefixes: [
      "/business-studies-activities",
      "/business-studies-classroom",
      "/business-studies-dashboard",
    ],
  },
  {
    familyKey: "english",
    canonicalSubjectId: "0d0f5c7f-23c6-4022-a5c3-f6e1c779b681",
    prefixes: [
      "/english-activities",
      "/english-classroom",
      "/english-dashboard",
    ],
  },
  {
    familyKey: "afrikaans",
    canonicalSubjectId: "e26c1112-3627-4a56-8f6a-4eab5d209b23",
    prefixes: [
      "/afrikaans-activities",
      "/afrikaans-classroom",
      "/afrikaans-dashboard",
    ],
  },
  {
    familyKey: "history",
    canonicalSubjectId: "dca2600c-932f-46bf-904c-a99be158e7f0",
    prefixes: [
      "/history-activities",
      "/history-classroom",
      "/history-dashboard",
    ],
  },
] as const;

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

type TeacherAuthDiagnostics = {
  hasSessionUser: boolean;
  profileFound: boolean;
  teacherProfileFound: boolean;
  reason: string;
};

function logTeacherAuth(
  pathname: string,
  diagnostics: TeacherAuthDiagnostics,
) {
  if (process.env.NODE_ENV === "development") {
    console.info("[teacher-auth]", { pathname, ...diagnostics });
  }
}

function isGenuinelyUnauthenticated(
  error: { name?: string; status?: number } | null,
) {
  return (
    !error ||
    error.name === "AuthSessionMissingError" ||
    error.status === 401 ||
    error.status === 403
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isTeacherRoute = teacherRoutePrefixes.some((prefix) =>
    matchesRoutePrefix(pathname, prefix),
  );
  const isAdministratorRoute = administratorRoutePrefixes.some((prefix) =>
    matchesRoutePrefix(pathname, prefix),
  );
  const isLearnerRoute = learnerRoutePrefixes.some((prefix) =>
    matchesRoutePrefix(pathname, prefix),
  );
  const isLearnerOnboardingRoute = matchesRoutePrefix(
    pathname,
    "/onboarding",
  );
  const requiredLearnerSubject = learnerSubjectRouteRequirements.find(
    (requirement) =>
      requirement.prefixes.some((prefix) =>
        matchesRoutePrefix(pathname, prefix),
      ),
  );
  const selectedLearnerSubjectId = request.nextUrl.searchParams.get("subject");
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (pathname === "/teacher/login") {
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  const redirectToLogin = async (
    reason: string,
    signOut: boolean,
    profileFound = false,
    teacherProfileFound = false,
  ) => {
    if (isTeacherRoute || isAdministratorRoute) {
      logTeacherAuth(pathname, {
        hasSessionUser: Boolean(user),
        profileFound,
        teacherProfileFound,
        reason,
      });
    }

    if (signOut) {
      const { error } = await supabase.auth.signOut();
      if (error && process.env.NODE_ENV === "development") {
        console.error("[teacher-auth] Unable to clear rejected session.", {
          reason,
          message: error.message,
        });
      }
    }

    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  };

  const verificationUnavailable = (
    reason: string,
    profileFound = false,
    teacherProfileFound = false,
  ) => {
    if (isTeacherRoute || isAdministratorRoute) {
      logTeacherAuth(pathname, {
        hasSessionUser: Boolean(user),
        profileFound,
        teacherProfileFound,
        reason,
      });
    }

    return copyResponseCookies(
      response,
      NextResponse.json(
        { error: "Unable to verify access. Please try again." },
        { status: 503 },
      ),
    );
  };

  const redirectForRouteMismatch = (
    authenticatedRole: "teacher" | "learner",
    destination: "/teacher" | "/home",
  ) => {
    if (process.env.NODE_ENV === "development") {
      console.info("[auth-route-mismatch]", {
        pathname,
        authenticatedRole,
        destination,
      });
    }

    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL(destination, request.url)),
    );
  };
  const redirectAuthenticatedLearner = (destination: string) =>
    copyResponseCookies(
      response,
      NextResponse.redirect(new URL(destination, request.url)),
    );

  if (!user) {
    if (isGenuinelyUnauthenticated(userError)) {
      return redirectToLogin("no_authenticated_session", false);
    }

    return verificationUnavailable("session_verification_failed");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return verificationUnavailable("server_authorization_not_configured");
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return verificationUnavailable("profile_lookup_failed");
  }

  if (!profile) {
    return redirectToLogin("profile_not_found", true);
  }

  if (isAdministratorRoute) {
    if (profile.role === "learner") {
      return redirectForRouteMismatch("learner", "/home");
    }

    if (profile.role !== "teacher") {
      return redirectToLogin("invalid_profile_role", true, true);
    }

    const { data: administratorProfile, error: administratorProfileError } =
      await admin
        .from("teacher_profiles")
        .select("id, is_administrator")
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

    if (administratorProfileError) {
      return verificationUnavailable(
        "administrator_profile_lookup_failed",
        true,
      );
    }

    if (!administratorProfile) {
      return redirectToLogin(
        "active_teacher_profile_not_found",
        true,
        true,
      );
    }

    if (administratorProfile.is_administrator !== true) {
      return redirectForRouteMismatch("teacher", "/teacher");
    }

    return response;
  }

  if (isTeacherRoute) {
    if (profile.role === "learner") {
      return redirectForRouteMismatch("learner", "/home");
    }

    if (profile.role !== "teacher") {
      return redirectToLogin("invalid_profile_role", true, true);
    }

    const { data: teacherProfile, error: teacherProfileError } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (teacherProfileError) {
      return verificationUnavailable("teacher_profile_lookup_failed", true);
    }

    if (!teacherProfile) {
      return redirectToLogin(
        "active_teacher_profile_not_found",
        true,
        true,
      );
    }

    logTeacherAuth(pathname, {
      hasSessionUser: true,
      profileFound: true,
      teacherProfileFound: true,
      reason: "access_allowed",
    });
    return response;
  }

  if (isLearnerRoute) {
    if (profile.role === "teacher") {
      return redirectForRouteMismatch("teacher", "/teacher");
    }

    if (profile.role !== "learner") {
      return redirectToLogin("invalid_profile_role", true);
    }

    const { data: learnerProfile, error: learnerProfileError } = await admin
      .from("learner_profiles")
      .select("id, school_name, grade, status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (learnerProfileError) {
      return verificationUnavailable("learner_profile_lookup_failed", true);
    }

    if (!learnerProfile) {
      if (pathname === "/onboarding/profile") return response;
      return redirectAuthenticatedLearner("/onboarding/profile");
    }

    if (learnerProfile.status !== "active") {
      return redirectToLogin("active_learner_profile_not_found", true);
    }

    if (
      !learnerProfile.school_name?.trim() ||
      !learnerProfile.grade?.trim()
    ) {
      if (pathname === "/onboarding/profile") return response;
      return redirectAuthenticatedLearner("/onboarding/profile");
    }

    if (requiredLearnerSubject) {
      const requestedSubject =
        selectedLearnerSubjectId
          ? getSubjectConfigurationByDatabaseId(selectedLearnerSubjectId)
          : null;
      const requiredSubjectId =
        requestedSubject &&
        requestedSubject.familyKey === requiredLearnerSubject.familyKey
          ? requestedSubject.databaseId
          : requiredLearnerSubject.canonicalSubjectId;

      const { data: enrolment, error: enrolmentError } = await admin
        .from("learner_subjects")
        .select("id")
        .eq("learner_profile_id", learnerProfile.id)
        .eq("subject_id", requiredSubjectId)
        .eq("status", "approved")
        .eq("is_active", true)
        .maybeSingle();

      if (enrolmentError) {
        return verificationUnavailable(
          "learner_subject_access_lookup_failed",
          true,
        );
      }

      if (!enrolment) {
        if (process.env.NODE_ENV === "development") {
          console.info("[learner-subject-route-denied]", {
            pathname,
            subjectId: requiredSubjectId,
            selectedSubjectId: selectedLearnerSubjectId,
          });
        }
        return redirectAuthenticatedLearner("/subjects");
      }
    }

    if (isLearnerOnboardingRoute) return response;
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/administrator/:path*",
    "/onboarding/:path*",
    "/teacher/:path*",
    "/home/:path*",
    "/subjects/:path*",
    "/activities/:path*",
    "/afrikaans-activities/:path*",
    "/afrikaans-classroom/:path*",
    "/afrikaans-dashboard/:path*",
    "/business-studies-activities/:path*",
    "/business-studies-classroom/:path*",
    "/business-studies-dashboard/:path*",
    "/english-activities/:path*",
    "/english-classroom/:path*",
    "/english-dashboard/:path*",
    "/history-activities/:path*",
    "/history-classroom/:path*",
    "/history-dashboard/:path*",
    "/chat/:path*",
    "/profile/:path*",
    "/schedule/:path*",
    "/tutor/:path*",
    "/your-work/:path*",
  ],
};
