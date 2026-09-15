import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via logAuthDiagnostic ->
// lib/observability/authDiagnostics.ts, and next/headers via
// lib/supabase/server.ts) and cannot be invoked directly in a plain
// node:test run -- see lib/supabase/coinLedger.test.ts's header comment
// for the established precedent. These tests verify the real source
// directly.

const SOURCE = readFileSync("app/api/auth/session/route.ts", "utf8");
const POST_FN = SOURCE.slice(SOURCE.indexOf("export async function POST("));

// AD ASTRA -- LOGIN VERIFICATION DIAGNOSTICS: the generic-message
// "Sign in could not be completed." on the login page can be produced by
// this route's UNAUTHORIZED (401) response or its VERIFY_FAILED (500)
// catch-all, and previously neither carried a requestId or a stage,
// making it impossible to tell a genuine auth.getUser() infrastructure
// failure apart from a thrown profile/teacher-profile/learner-profile/
// learner-subjects query failure in production logs. Both are now
// instrumented with the shared logAuthDiagnostic helper (same
// requestId-correlated, safe-fields-only shape already used by
// authorizeTeacher/getAuthenticatedTeacherProfile) without changing any
// returned status/code/error text, destination, or auth/RLS behaviour.

test("D: the catch-all now logs via the shared logAuthDiagnostic helper, not a bare console.error, so VERIFY_FAILED carries a requestId", () => {
  assert.doesNotMatch(
    POST_FN,
    /console\.error\("AD Astra session verification failed:"/,
  );
  assert.match(
    POST_FN,
    /await logAuthDiagnostic\(\s*\n\s*"AD Astra session verification failed:",\s*\n\s*`auth-session\.\$\{stage\}`,\s*\n\s*"verification_failed",\s*\n\s*error,\s*\n\s*\);/,
  );
});

test("B: a genuine auth.getUser() error is logged under stage 'auth-session.auth-user' with reason 'auth_get_user_failed', distinct from the ordinary no-user case", () => {
  assert.match(POST_FN, /if \(userError\) \{/);
  assert.match(
    POST_FN,
    /await logAuthDiagnostic\(\s*\n\s*"AD Astra session verification failed:",\s*\n\s*"auth-session\.auth-user",\s*\n\s*"auth_get_user_failed",\s*\n\s*userError,\s*\n\s*\);/,
  );
});

test("regression: the userError diagnostic never gates or delays the actual 401 outcome -- the existing '(userError || !user)' rejection is unchanged and still runs after the log", () => {
  const logIndex = POST_FN.indexOf(
    'await logAuthDiagnostic(\n        "AD Astra session verification failed:",\n        "auth-session.auth-user"',
  );
  const rejectionIndex = POST_FN.indexOf("if (userError || !user) {");
  assert.ok(
    logIndex > -1 && rejectionIndex > -1 && logIndex < rejectionIndex,
    "expected the auth-user diagnostic to appear before the unchanged 401 rejection",
  );
});

test("2: ordinary expected outcomes (profile not found, invalid role, inactive teacher, inactive learner) are not turned into diagnostic log calls -- only thrown/infrastructure failures and the genuine auth-user error are logged", () => {
  const logCallCount = (POST_FN.match(/await logAuthDiagnostic\(/g) ?? [])
    .length;
  assert.equal(
    logCallCount,
    2,
    "expected exactly two logAuthDiagnostic call sites: the auth-user error case and the catch-all",
  );

  for (const routineCode of [
    "PROFILE_NOT_FOUND",
    "INVALID_ROLE",
    "INACTIVE_TEACHER",
    "INACTIVE_LEARNER",
  ]) {
    const codeIndex = POST_FN.indexOf(`code: "${routineCode}"`);
    assert.ok(codeIndex > -1, `expected to find code: "${routineCode}"`);
    const precedingSlice = POST_FN.slice(
      Math.max(0, codeIndex - 400),
      codeIndex,
    );
    assert.doesNotMatch(
      precedingSlice,
      /logAuthDiagnostic/,
      `expected no logAuthDiagnostic call immediately before the ${routineCode} response`,
    );
  }
});

test("1: stage tracking reflects the actual route structure -- profile-lookup, role-validation, teacher-profile, learner-profile, and learner-subjects are each set immediately before their corresponding real query/check", () => {
  assert.match(
    POST_FN,
    /stage = "profile-lookup";\s*\n\s*const \{ data: profile, error: profileError \} = await admin/,
  );
  assert.match(
    POST_FN,
    /stage = "role-validation";\s*\n\s*if \(!isAccountRole\(profile\.role\)\) \{/,
  );
  assert.match(
    POST_FN,
    /stage = "teacher-profile";\s*\n\s*const \{ data: teacherProfile, error: teacherError \} = await admin/,
  );
  assert.match(
    POST_FN,
    /stage = "learner-profile";\s*\n\s*const \{ data: learnerProfile, error: learnerError \} = await admin/,
  );
  assert.match(
    POST_FN,
    /stage = "learner-subjects";\s*\n\s*const \{ count: subjectRequestCount, error: subjectRequestError \} =/,
  );
});

test("F: only the shared toSafeErrorDetails-backed helper receives the raw error -- both logAuthDiagnostic calls pass only requestId/stage/reason/error, never a token, cookie, password, email, or ID literal", () => {
  const logCalls = [
    ...POST_FN.matchAll(/await logAuthDiagnostic\(([\s\S]*?)\);/g),
  ].map((match) => match[1]);
  assert.equal(logCalls.length, 2, "expected exactly two logAuthDiagnostic calls to inspect");

  for (const args of logCalls) {
    assert.doesNotMatch(
      args,
      /accessToken|refreshToken|authorization header|cookie|password|email|user\.id|profile\.id|learnerProfile\.id|teacherProfile\.id/i,
      `logAuthDiagnostic call arguments must never reference a token/cookie/password/email/ID: ${args}`,
    );
  }
});

test("regression: every response status/code/error string is byte-for-byte unchanged", () => {
  assert.match(
    POST_FN,
    /\{ error: "Sign-in is required\.", code: "UNAUTHORIZED" \},\s*\n\s*\{ status: 401 \}/,
  );
  assert.match(
    POST_FN,
    /\{ error: "Profile not found\.", code: "PROFILE_NOT_FOUND" \},\s*\n\s*\{ status: 403 \}/,
  );
  assert.match(POST_FN, /error: "This account does not have an authorised role\.",\s*\n\s*code: "INVALID_ROLE",/);
  assert.match(
    POST_FN,
    /\{ error: "Teacher account is inactive\.", code: "INACTIVE_TEACHER" \},\s*\n\s*\{ status: 403 \}/,
  );
  assert.match(
    POST_FN,
    /\{ error: "Learner account is inactive\.", code: "INACTIVE_LEARNER" \},\s*\n\s*\{ status: 403 \}/,
  );
  assert.match(
    POST_FN,
    /\{ error: "Sign-in could not be verified\.", code: "VERIFY_FAILED" \},\s*\n\s*\{ status: 500 \}/,
  );
});

test("regression: destination logic (learnerOnboardingDestination / destinationForAccountRole calls and their arguments) is unchanged", () => {
  assert.match(
    POST_FN,
    /learnerOnboardingDestination\(\{\s*\n\s*hasLearnerProfile: Boolean\(learnerProfile\),\s*\n\s*profileComplete: false,\s*\n\s*hasAnySubjectRequest: false,\s*\n\s*\}\)/,
  );
  assert.match(
    POST_FN,
    /learnerOnboardingDestination\(\{\s*\n\s*hasLearnerProfile: true,\s*\n\s*profileComplete: true,\s*\n\s*hasAnySubjectRequest: false,\s*\n\s*\}\)/,
  );
  assert.match(POST_FN, /destination: destinationForAccountRole\(profile\.role\)/);
});

test("regression: sign-out is still called for every definitive authorization failure (profile not found, invalid role, inactive teacher, inactive learner), unchanged by the new diagnostics", () => {
  const signOutCount = (
    POST_FN.match(/await requestClient\.auth\.signOut\(\);/g) ?? []
  ).length;
  assert.equal(signOutCount, 4);
});

test("regression: auth resolution still goes through createSupabaseRequestClient().auth.getUser() first, then the service-role admin client only afterwards -- no new/parallel auth path or RLS change", () => {
  const requestClientIndex = POST_FN.indexOf(
    "const requestClient = await createSupabaseRequestClient();",
  );
  const getUserIndex = POST_FN.indexOf("await requestClient.auth.getUser();");
  const adminClientIndex = POST_FN.indexOf(
    "const admin = createSupabaseAdminClient();",
  );
  assert.ok(
    requestClientIndex > -1 &&
      getUserIndex > -1 &&
      adminClientIndex > -1 &&
      requestClientIndex < getUserIndex &&
      getUserIndex < adminClientIndex,
  );
});
