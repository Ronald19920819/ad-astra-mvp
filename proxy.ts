import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { REQUEST_ID_HEADER } from "@/lib/observability/requestId";

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
  "/xp-coins",
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

// stage identifies exactly which step of proxy's own auth/profile/role
// chain produced this outcome (see the ordered list of stage values used
// throughout proxy() below: proxy.auth, proxy.config, proxy.profile,
// proxy.teacher-profile, proxy.teacher-access,
// proxy.administrator-profile, proxy.administrator-access,
// proxy.learner-profile, proxy.learner-access). requestId correlates
// this line with the same request's downstream page-level auth log (if
// any) in teacherAuth.ts/teacherProfile.ts/learnerProfile.ts. Neither
// value is ever used for an authorization decision -- both are
// diagnostics only.
type ProxyAuthDiagnostics = {
  stage: string;
  reason: string;
  hasSessionUser: boolean;
  profileFound: boolean;
  roleProfileFound: boolean;
};

// "access_allowed" and "no_authenticated_session" are the routine,
// high-volume outcomes of every normal request (a successful visit, or a
// plain logged-out visitor) -- logging those unconditionally would be
// exactly the noisy production logging this must avoid. Every other
// reason represents a genuine failure (a DB lookup error, a role
// mismatch, a missing profile for an authenticated session, a missing
// subject enrolment) that was previously only ever logged in
// development (or, for learner routes, never logged at all), meaning
// production could not distinguish *why* a request was rejected. Those
// are now always logged, with safe fields only -- requestId, pathname,
// stage/reason, and boolean found-flags, never a token, cookie, email,
// name, or user ID.
const ROUTINE_PROXY_AUTH_REASONS = new Set([
  "no_authenticated_session",
  "access_allowed",
]);

function logProxyAuthEvent(
  requestId: string,
  pathname: string,
  diagnostics: ProxyAuthDiagnostics,
) {
  if (ROUTINE_PROXY_AUTH_REASONS.has(diagnostics.reason)) {
    if (process.env.NODE_ENV === "development") {
      console.info("[proxy-auth]", { requestId, pathname, ...diagnostics });
    }
    return;
  }

  console.error("[proxy-auth] Authorization check failed:", {
    requestId,
    pathname,
    ...diagnostics,
  });
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

  // DIAGNOSTICS ONLY -- never used for any authentication/authorization
  // decision. A short per-request correlation ID lets a production log
  // line from this proxy be matched against the same request's
  // downstream page-level auth log line (teacherAuth.ts/
  // teacherProfile.ts/learnerProfile.ts), without logging any
  // session/cookie/token/user-identifying data. Any client-supplied
  // value of this header is always overwritten here -- it is never
  // trusted from the incoming request.
  const requestId = crypto.randomUUID().slice(0, 8);
  request.headers.set(REQUEST_ID_HEADER, requestId);

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

  // API routes (Route Handlers) always return JSON and already perform
  // their own authorization via authorizeTeacher()/authorizeAdministrator()
  // or the equivalent learner checks, each backed by RLS -- none of that
  // changes here. This proxy's only job for API traffic is to ensure the
  // session cookie is refreshed and persisted BEFORE the route handler
  // reads it, which the auth.getUser() call above already did. The
  // role/profile redirect gating below is written for HTML page
  // navigation (it redirects to /login, /home, /subjects, etc.) and must
  // never run for an API call -- a fetch() expecting JSON must not
  // receive a 3xx redirect or an HTML login page in its place.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (pathname === "/teacher/login") {
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  const redirectToLogin = async (options: {
    reason: string;
    stage: string;
    signOut: boolean;
    profileFound?: boolean;
    roleProfileFound?: boolean;
  }) => {
    logProxyAuthEvent(requestId, pathname, {
      stage: options.stage,
      reason: options.reason,
      hasSessionUser: Boolean(user),
      profileFound: options.profileFound ?? false,
      roleProfileFound: options.roleProfileFound ?? false,
    });

    if (options.signOut) {
      const { error } = await supabase.auth.signOut();
      if (error && process.env.NODE_ENV === "development") {
        console.error("[proxy-auth] Unable to clear rejected session.", {
          requestId,
          reason: options.reason,
          message: error.message,
        });
      }
    }

    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  };

  const verificationUnavailable = (options: {
    reason: string;
    stage: string;
    profileFound?: boolean;
    roleProfileFound?: boolean;
  }) => {
    logProxyAuthEvent(requestId, pathname, {
      stage: options.stage,
      reason: options.reason,
      hasSessionUser: Boolean(user),
      profileFound: options.profileFound ?? false,
      roleProfileFound: options.roleProfileFound ?? false,
    });

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
        requestId,
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
      return redirectToLogin({
        reason: "no_authenticated_session",
        stage: "proxy.auth",
        signOut: false,
      });
    }

    return verificationUnavailable({
      reason: "session_verification_failed",
      stage: "proxy.auth",
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return verificationUnavailable({
      reason: "server_authorization_not_configured",
      stage: "proxy.config",
    });
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
    return verificationUnavailable({
      reason: "profile_lookup_failed",
      stage: "proxy.profile",
    });
  }

  if (!profile) {
    return redirectToLogin({
      reason: "profile_not_found",
      stage: "proxy.profile",
      signOut: true,
      profileFound: false,
    });
  }

  if (isAdministratorRoute) {
    if (profile.role === "learner") {
      return redirectForRouteMismatch("learner", "/home");
    }

    if (profile.role !== "teacher") {
      return redirectToLogin({
        reason: "invalid_profile_role",
        stage: "proxy.administrator-access",
        signOut: true,
        profileFound: true,
      });
    }

    const { data: administratorProfile, error: administratorProfileError } =
      await admin
        .from("teacher_profiles")
        .select("id, is_administrator")
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

    if (administratorProfileError) {
      return verificationUnavailable({
        reason: "administrator_profile_lookup_failed",
        stage: "proxy.administrator-profile",
        profileFound: true,
      });
    }

    if (!administratorProfile) {
      return redirectToLogin({
        reason: "active_teacher_profile_not_found",
        stage: "proxy.administrator-profile",
        signOut: true,
        profileFound: true,
        roleProfileFound: false,
      });
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
      return redirectToLogin({
        reason: "invalid_profile_role",
        stage: "proxy.teacher-access",
        signOut: true,
        profileFound: true,
      });
    }

    const { data: teacherProfile, error: teacherProfileError } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (teacherProfileError) {
      return verificationUnavailable({
        reason: "teacher_profile_lookup_failed",
        stage: "proxy.teacher-profile",
        profileFound: true,
      });
    }

    if (!teacherProfile) {
      return redirectToLogin({
        reason: "active_teacher_profile_not_found",
        stage: "proxy.teacher-profile",
        signOut: true,
        profileFound: true,
        roleProfileFound: false,
      });
    }

    logProxyAuthEvent(requestId, pathname, {
      stage: "proxy.teacher-access",
      reason: "access_allowed",
      hasSessionUser: true,
      profileFound: true,
      roleProfileFound: true,
    });
    return response;
  }

  if (isLearnerRoute) {
    if (profile.role === "teacher") {
      return redirectForRouteMismatch("teacher", "/teacher");
    }

    if (profile.role !== "learner") {
      return redirectToLogin({
        reason: "invalid_profile_role",
        stage: "proxy.learner-access",
        signOut: true,
        profileFound: true,
      });
    }

    const { data: learnerProfile, error: learnerProfileError } = await admin
      .from("learner_profiles")
      .select("id, school_name, grade, status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (learnerProfileError) {
      return verificationUnavailable({
        reason: "learner_profile_lookup_failed",
        stage: "proxy.learner-profile",
        profileFound: true,
      });
    }

    if (!learnerProfile) {
      if (pathname === "/onboarding/profile") return response;
      return redirectAuthenticatedLearner("/onboarding/profile");
    }

    if (learnerProfile.status !== "active") {
      return redirectToLogin({
        reason: "active_learner_profile_not_found",
        stage: "proxy.learner-profile",
        signOut: true,
        profileFound: true,
        roleProfileFound: false,
      });
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
        return verificationUnavailable({
          reason: "learner_subject_access_lookup_failed",
          stage: "proxy.learner-access",
          profileFound: true,
          roleProfileFound: true,
        });
      }

      if (!enrolment) {
        // Deliberately no subject/learner ID logged here (diagnostics
        // should prefer not to log IDs at all) -- stage + reason alone
        // are enough to know a learner hit a subject they are not
        // enrolled in, without identifying which learner or which
        // subject in the log itself.
        logProxyAuthEvent(requestId, pathname, {
          stage: "proxy.learner-access",
          reason: "learner_subject_not_enrolled",
          hasSessionUser: true,
          profileFound: true,
          roleProfileFound: true,
        });
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
    // Every API route needs its session refreshed before the Route
    // Handler reads it (see the pathname.startsWith("/api/") early-return
    // above) -- without this, API-driven teacher/learner features got no
    // benefit from this proxy at all and relied solely on each request's
    // own in-request refresh, which cannot always persist the refreshed
    // cookie back to the browser. This is intentionally broad (all of
    // /api) rather than an enumerated subset, so a newly added
    // authenticated route can never be silently left uncovered.
    "/api/:path*",
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
    "/xp-coins/:path*",
  ],
};
