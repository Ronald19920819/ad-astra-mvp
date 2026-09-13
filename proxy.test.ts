import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "./proxy";
import { REQUEST_ID_HEADER } from "@/lib/observability/requestId";

// AD ASTRA -- CENTRAL SUPABASE SESSION REFRESH + REQUEST-CORRELATION
// DIAGNOSTICS
//
// proxy.ts (Next.js 16's renamed "Middleware" -- see its own file
// history for the "why proxy, not middleware.ts" rationale) already had
// a working session-refresh mechanism and extensive page-level
// role/redirect gating for teacher/administrator/learner routes before
// this session. Two real, narrow gaps were closed: its matcher never
// covered /api/:path*, and genuine authorization-check failures were
// only ever logged in development (or, for learner routes, never
// logged at all).
//
// This latest change adds a short per-request diagnostic correlation ID
// (x-ad-astra-request-id), generated fresh on every request and always
// overwritten if a client happened to send one, so a production log line
// from this proxy can be matched against the same request's downstream
// page-level auth log line in teacherAuth.ts/teacherProfile.ts/
// learnerProfile.ts -- purely for observability. It is never read back
// by proxy.ts itself and never used for any authorization decision.
//
// proxy() itself does live Supabase/DB network calls and cannot be
// invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. Its matcher is real, executable configuration and is tested
// directly via next/experimental/testing/server's exported
// unstable_doesMiddlewareMatch (the installed Next.js version, 16.2.6,
// still exports this name -- the public docs describe a renamed
// unstable_doesProxyMatch that has not shipped in this exact version;
// verified directly against node_modules rather than trusted from docs).
// Everything else is verified via source inspection.

function matches(url: string) {
  return unstable_doesMiddlewareMatch({ config, url });
}

const SOURCE = readFileSync("proxy.ts", "utf8");
const proxyFnMatch = SOURCE.match(/export async function proxy\([\s\S]*?\n\}/);
if (!proxyFnMatch) throw new Error("proxy() function not found in proxy.ts");
const PROXY_FN = proxyFnMatch[0];

test("REQUEST_ID_HEADER imported here matches the exact literal proxy.ts sets on the request -- no drift between the shared constant and its usage", () => {
  assert.equal(REQUEST_ID_HEADER, "x-ad-astra-request-id");
  assert.match(PROXY_FN, /request\.headers\.set\(REQUEST_ID_HEADER, requestId\);/);
});

// ---- Matcher coverage -------------------------------------------------

test("the matcher now covers every API route, so API-driven teacher and learner features benefit from centralized session refresh", () => {
  assert.equal(matches("https://ad-astra.example/api/teacher/reviews/abc-123"), true);
  assert.equal(matches("https://ad-astra.example/api/teacher/business-studies/activities"), true);
  assert.equal(matches("https://ad-astra.example/api/kingdom/mark-activity"), true);
  assert.equal(matches("https://ad-astra.example/api/lessons/complete"), true);
  assert.equal(matches("https://ad-astra.example/api/teacher/admin/coins"), true);
});

test("regression: every pre-existing page-route prefix is still covered exactly as before", () => {
  assert.equal(matches("https://ad-astra.example/teacher/subjects/business-studies"), true);
  assert.equal(matches("https://ad-astra.example/teacher/subjects/business-studies/review"), true);
  assert.equal(matches("https://ad-astra.example/administrator/coins"), true);
  assert.equal(matches("https://ad-astra.example/home"), true);
  assert.equal(matches("https://ad-astra.example/subjects"), true);
  assert.equal(matches("https://ad-astra.example/onboarding/profile"), true);
  assert.equal(matches("https://ad-astra.example/your-work/abc-123"), true);
});

test("CONFIRMED: the exact teacher Subject Overview and Activity Review URLs were already matched before the /api addition", () => {
  assert.equal(matches("https://ad-astra.example/teacher/subjects/business-studies?subject=c472f3c9-0e6f-40de-a748-3ad9400ac069"), true);
  assert.equal(matches("https://ad-astra.example/teacher/subjects/business-studies/review"), true);
  assert.equal(matches("https://ad-astra.example/teacher/subjects/business-studies/review/11111111-1111-1111-1111-111111111111"), true);
});

test("CONFIRMED: the exact learner Subject Dashboard URL is already matched (via the /business-studies-dashboard learner prefix)", () => {
  assert.equal(matches("https://ad-astra.example/business-studies-dashboard"), true);
  assert.equal(matches("https://ad-astra.example/business-studies-dashboard?subject=c472f3c9-0e6f-40de-a748-3ad9400ac069"), true);
});

test("does not match unrelated public paths (e.g. the marketing/login pages) -- unchanged from before", () => {
  assert.equal(matches("https://ad-astra.example/login"), false);
  assert.equal(matches("https://ad-astra.example/"), false);
});

// ---- API early-return ---------------------------------------------------

test("API routes return immediately after the session refresh, before the /teacher/login special case or any role/profile redirect gating", () => {
  const apiEarlyReturnIndex = PROXY_FN.indexOf('if (pathname.startsWith("/api/")) {');
  const teacherLoginIndex = PROXY_FN.indexOf('if (pathname === "/teacher/login") {');
  const profileLookupIndex = PROXY_FN.indexOf('.from("profiles")');
  const authGetUserIndex = PROXY_FN.indexOf(".auth.getUser();");

  assert.ok(
    apiEarlyReturnIndex > -1 &&
      teacherLoginIndex > -1 &&
      profileLookupIndex > -1 &&
      authGetUserIndex > -1,
  );
  assert.ok(authGetUserIndex < apiEarlyReturnIndex);
  assert.ok(apiEarlyReturnIndex < teacherLoginIndex);
  assert.ok(apiEarlyReturnIndex < profileLookupIndex);
});

test("the API early-return does not perform an authorization decision itself -- it returns the plain refreshed response, never a redirect or a fabricated success", () => {
  const apiBranch = SOURCE.match(/if \(pathname\.startsWith\("\/api\/"\)\) \{\s*\n\s*return response;\s*\n\s*\}/)?.[0];
  assert.ok(apiBranch, "the /api/ early-return branch was not found in this exact shape");
});

// ---- Diagnostic request-correlation ID -----------------------------------

test("REQUEST ID: a fresh correlation ID is generated on every request via crypto.randomUUID(), never derived from anything client-supplied", () => {
  assert.match(PROXY_FN, /const requestId = crypto\.randomUUID\(\)\.slice\(0, 8\);/);
});

test("REQUEST ID: is set on the request headers unconditionally -- there is no prior check for an existing client-supplied value, so any incoming header of the same name is always overwritten, never trusted or merged", () => {
  const setIndex = PROXY_FN.indexOf(`request.headers.set(REQUEST_ID_HEADER, requestId);`);
  assert.ok(setIndex > -1, "request.headers.set(REQUEST_ID_HEADER, requestId) not found");

  // No conditional guard immediately before the set call (e.g. checking
  // request.headers.has/get first) -- confirms unconditional overwrite.
  const precedingLines = PROXY_FN.slice(Math.max(0, setIndex - 200), setIndex);
  assert.doesNotMatch(precedingLines, /if \(.*REQUEST_ID_HEADER/);
  assert.doesNotMatch(PROXY_FN, /request\.headers\.get\(REQUEST_ID_HEADER\)/);
  assert.doesNotMatch(PROXY_FN, /request\.headers\.has\(REQUEST_ID_HEADER\)/);
});

test("REQUEST ID: is set before the first NextResponse.next({ request }) construction, so it is forwarded downstream on every response path (including the earliest 'let response =' assignment and every later rebuild inside the cookie setAll callback)", () => {
  const setIndex = PROXY_FN.indexOf(`request.headers.set(REQUEST_ID_HEADER, requestId);`);
  const firstResponseIndex = PROXY_FN.indexOf("let response = NextResponse.next({ request });");
  assert.ok(setIndex > -1 && firstResponseIndex > -1);
  assert.ok(setIndex < firstResponseIndex);
});

test("REQUEST ID: never read back by proxy.ts itself and never used in any conditional -- it is generated, set, and only ever passed straight into logProxyAuthEvent(requestId, ...) calls", () => {
  assert.doesNotMatch(SOURCE, /if\s*\(\s*requestId/);
  assert.doesNotMatch(SOURCE, /requestId\s*===|requestId\s*!==/);
  // Every use of the requestId variable after its own declaration line is
  // either passing it to logProxyAuthEvent(...) or into a plain log object.
  const usages = PROXY_FN.split("requestId").length - 1;
  const loggingUsages = (PROXY_FN.match(/logProxyAuthEvent\(\s*\n?\s*requestId,/g) ?? []).length +
    (PROXY_FN.match(/\{\s*requestId,/g) ?? []).length;
  assert.ok(usages > 0 && loggingUsages > 0);
});

test("REQUEST ID: not authoritative for authentication -- the actual authentication decision is made entirely from supabase.auth.getUser()'s own result, never from the presence/absence/value of the diagnostic header", () => {
  const authDecisionBlock = PROXY_FN.slice(
    PROXY_FN.indexOf("if (!user) {"),
    PROXY_FN.indexOf("if (!process.env.SUPABASE_SERVICE_ROLE_KEY)"),
  );
  assert.doesNotMatch(authDecisionBlock, /requestId/);
  assert.match(authDecisionBlock, /isGenuinelyUnauthenticated\(userError\)/);
});

// ---- Stage-labelled, requestId-correlated failure logging ----------------

test("F: logProxyAuthEvent always includes requestId, pathname, and an explicit stage for every genuine failure -- distinguishable from previous unlabelled logging", () => {
  const logFn = SOURCE.match(/function logProxyAuthEvent\([\s\S]*?\n\}/)?.[0];
  assert.ok(logFn, "logProxyAuthEvent not found");
  assert.match(logFn!, /console\.error\("\[proxy-auth\] Authorization check failed:",/);
  assert.match(logFn!, /requestId,\s*\n\s*pathname,\s*\n\s*\.\.\.diagnostics,/);
});

test("F: every distinguishable proxy-stage value from the spec is present at least once: proxy.auth, proxy.config, proxy.profile, proxy.teacher-profile, proxy.teacher-access, proxy.administrator-profile, proxy.administrator-access, proxy.learner-profile, proxy.learner-access", () => {
  for (const stage of [
    "proxy.auth",
    "proxy.config",
    "proxy.profile",
    "proxy.teacher-profile",
    "proxy.teacher-access",
    "proxy.administrator-profile",
    "proxy.administrator-access",
    "proxy.learner-profile",
    "proxy.learner-access",
  ]) {
    assert.ok(SOURCE.includes(`"${stage}"`), `stage "${stage}" not found in proxy.ts`);
  }
});

test("F: a previously entirely-unlogged learner failure (subject enrolment denied) is now logged with a stage, still without logging the subject or learner ID", () => {
  const enrolmentDeniedBlock = PROXY_FN.match(/if \(!enrolment\) \{[\s\S]*?\n\s*\}/)?.[0];
  assert.ok(enrolmentDeniedBlock, "the !enrolment branch was not found");
  assert.match(enrolmentDeniedBlock!, /stage: "proxy\.learner-access",/);
  assert.match(enrolmentDeniedBlock!, /reason: "learner_subject_not_enrolled",/);
  assert.doesNotMatch(enrolmentDeniedBlock!, /subjectId|learnerProfile\.id|selectedLearnerSubjectId/);
});

test("F: the two routine, high-volume outcomes ('no signed-in session' and 'access allowed') remain development-only and are never logged unconditionally", () => {
  const logFn = SOURCE.match(/function logProxyAuthEvent\([\s\S]*?\n\}/)?.[0];
  assert.ok(logFn);
  assert.match(logFn!, /ROUTINE_PROXY_AUTH_REASONS\.has\(diagnostics\.reason\)/);
  assert.match(SOURCE, /const ROUTINE_PROXY_AUTH_REASONS = new Set\(\[\s*\n\s*"no_authenticated_session",\s*\n\s*"access_allowed",\s*\n\s*\]\);/);
});

test("F: the logged fields never include a token, cookie, session, email, name, or user ID -- only requestId, pathname, stage/reason, and boolean found-flags", () => {
  const logFn = SOURCE.match(/function logProxyAuthEvent\([\s\S]*?\n\}/)?.[0];
  assert.ok(logFn);
  assert.doesNotMatch(logFn!, /\.value|cookieStore|access_token|refresh_token|\.email|userId|user\.id/);
  const diagnosticsType = SOURCE.match(/type ProxyAuthDiagnostics = \{[\s\S]*?\};/)?.[0];
  assert.ok(diagnosticsType);
  assert.doesNotMatch(diagnosticsType!, /email|name|userId|token|cookie/i);
});

// ---- Regression: existing role/redirect gating and cookie mechanics -----

test("regression: the teacher/administrator/learner role and profile-status checks inside the page-gating logic are byte-for-byte unchanged", () => {
  assert.match(SOURCE, /if \(profile\.role === "learner"\) \{\s*\n\s*return redirectForRouteMismatch\("learner", "\/home"\);/);
  assert.match(SOURCE, /administratorProfile\.is_administrator !== true/);
  assert.match(SOURCE, /learnerProfile\.status !== "active"/);
});

test("does not weaken authentication -- an unauthenticated or unverifiable session is still redirected to login or rejected with 503, never let through", () => {
  assert.match(SOURCE, /reason: "no_authenticated_session",/);
  assert.match(SOURCE, /reason: "session_verification_failed",/);
});

test("still does not use the service-role key to resolve the user's identity -- createServerClient (anon-key, cookie-scoped) resolves auth.getUser() first; the service-role admin client is only used afterwards for profile/role lookups", () => {
  const authGetUserIndex = PROXY_FN.indexOf(".auth.getUser();");
  const serviceRoleIndex = PROXY_FN.indexOf("process.env.SUPABASE_SERVICE_ROLE_KEY");
  assert.ok(authGetUserIndex > -1 && serviceRoleIndex > -1 && authGetUserIndex < serviceRoleIndex);
});

test("H: no redirect loop -- /teacher/login is exempted unconditionally, first, before any gated logic can run", () => {
  const teacherLoginIndex = PROXY_FN.indexOf('if (pathname === "/teacher/login")');
  const redirectToLoginDeclIndex = PROXY_FN.indexOf("const redirectToLogin =");
  assert.ok(teacherLoginIndex > -1 && redirectToLoginDeclIndex > -1 && teacherLoginIndex < redirectToLoginDeclIndex);
  const matcherBlock = SOURCE.match(/export const config = \{[\s\S]*?\n\};/)?.[0] ?? "";
  assert.doesNotMatch(matcherBlock, /"\/login/);
});

test("does not use the service-role key for the cookie-session client (only NEXT_PUBLIC_SUPABASE_ANON_KEY) -- unchanged", () => {
  const cookieClientBlock = PROXY_FN.match(/const supabase = createServerClient\([\s\S]*?\n\s*\);/)?.[0];
  assert.ok(cookieClientBlock);
  assert.match(cookieClientBlock!, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(cookieClientBlock!, /SERVICE_ROLE/);
});
