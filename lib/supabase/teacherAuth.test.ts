import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/teacherAuth.ts imports "server-only" and cannot be
// invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("lib/supabase/teacherAuth.ts", "utf8");
const authorizeFn = SOURCE.slice(
  SOURCE.indexOf("export async function authorizeTeacher("),
  SOURCE.indexOf("export async function authorizeAdministrator("),
);

// AD ASTRA -- CENTRAL SUPABASE SESSION REFRESH (proxy.ts): E -- existing
// teacher authorization must remain intact. proxy.ts only refreshes the
// session cookie; it performs no authorization decision, so every check
// below must be entirely unchanged from before that fix.

test("E: still resolves the user via createSupabaseRequestClient().auth.getUser() -- the session layer change did not introduce a second, parallel authentication path", () => {
  assert.match(authorizeFn, /const requestClient = await createSupabaseRequestClient\(\);/);
  assert.match(authorizeFn, /await requestClient\.auth\.getUser\(\);/);
});

test("E: an unauthenticated caller still gets a plain 401 UNAUTHORIZED -- the new diagnostic logging does not change the returned authorization result", () => {
  assert.match(authorizeFn, /return failure\(401, "UNAUTHORIZED", "Teacher sign-in is required\."\);/);
});

test("E: a genuine auth error (not just a missing user) is now logged via the shared logAuthDiagnostic helper with stage 'teacher-page.auth' -- no token, cookie, or session value", () => {
  assert.match(authorizeFn, /if \(userError\) \{/);
  const logCall = authorizeFn.match(/await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.auth",\s*\n\s*"auth_get_user_failed",\s*\n\s*userError,\s*\n\s*\);/)?.[0];
  assert.ok(logCall, "the auth_get_user_failed logAuthDiagnostic call was not found");
});

test("E: logging never gates or delays the actual authorization outcome -- the existing '(userError || !user)' rejection is unchanged and still runs after the log", () => {
  const logIndex = authorizeFn.indexOf('await logAuthDiagnostic(\n      "Teacher authorization failed:",\n      "teacher-page.auth"');
  const rejectionIndex = authorizeFn.indexOf("if (userError || !user) {");
  assert.ok(logIndex > -1 && rejectionIndex > -1 && logIndex < rejectionIndex);
});

test("E: role/status/subject-assignment checks are still exactly as before -- profile must be role='teacher', teacher_profiles must be status='active', and a subject check still requires an active teacher_subjects assignment", () => {
  assert.match(authorizeFn, /\.eq\("role", "teacher"\)/);
  assert.match(authorizeFn, /\.eq\("status", "active"\)/);
  assert.match(authorizeFn, /\.eq\("teacher_profile_id", teacherProfile\.id\)\s*\n\s*\.eq\("subject_id", subjectId\)\s*\n\s*\.eq\("status", "active"\)/);
});

// D/E -- FOLLOW-UP DIAGNOSTIC IMPROVEMENT: every distinguishable failure
// stage inside authorizeTeacher() is now labelled and logged (diagnostic
// classification only -- none of these change the returned
// TeacherAuthorizationResult or its status/code/error text).

test("D: a profiles lookup DB error and a genuinely missing profile row are now distinguished by stage 'teacher-page.profile' with different reasons, before their pre-existing throw/403 outcome respectively", () => {
  assert.match(
    authorizeFn,
    /if \(profileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_lookup_failed",\s*\n\s*profileError,\s*\n\s*\);\s*\n\s*throw profileError;/,
  );
  assert.match(
    authorizeFn,
    /if \(!profile\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_not_found",\s*\n\s*\);\s*\n\s*return failure\(403, "FORBIDDEN", "Teacher access is required\."\);/,
  );
});

test("D: a teacher_profiles lookup DB error and a missing/inactive active teacher profile are distinguished by stage 'teacher-page.teacher-profile', before their pre-existing throw/403 outcome respectively", () => {
  assert.match(
    authorizeFn,
    /if \(teacherProfileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*"teacher_profile_lookup_failed",\s*\n\s*teacherProfileError,\s*\n\s*\);\s*\n\s*throw teacherProfileError;/,
  );
  assert.match(
    authorizeFn,
    /if \(!teacherProfile\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*"active_teacher_profile_not_found",\s*\n\s*\);\s*\n\s*return failure\(403, "FORBIDDEN", "Active teacher access is required\."\);/,
  );
});

test("D: a subject-assignment DB error and a genuinely missing assignment are distinguished by stage 'teacher-page.subject-assignment', matching the exact failure Activity Review depends on", () => {
  assert.match(authorizeFn, /if \(assignmentError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.subject-assignment",\s*\n\s*"subject_assignment_lookup_failed",\s*\n\s*assignmentError,/);
  assert.match(authorizeFn, /if \(!assignment\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher authorization failed:",\s*\n\s*"teacher-page\.subject-assignment",\s*\n\s*"subject_not_assigned",/);
});

test("regression: none of the new diagnostic logging changed any returned status/code/error string in TeacherAuthorizationResult", () => {
  assert.match(authorizeFn, /return failure\(403, "FORBIDDEN", "Teacher access is required\."\);/);
  assert.match(authorizeFn, /return failure\(403, "FORBIDDEN", "Active teacher access is required\."\);/);
  assert.match(
    authorizeFn,
    /return failure\(\s*\n\s*403,\s*\n\s*"FORBIDDEN",\s*\n\s*"Teacher access to this subject is required\.",\s*\n\s*\);/,
  );
});

test("G: authorizeAdministrator still delegates to authorizeTeacher and still requires isAdministrator -- admin authorization is untouched", () => {
  const adminFn = SOURCE.slice(SOURCE.indexOf("export async function authorizeAdministrator("));
  assert.match(adminFn, /const authorization = await authorizeTeacher\(\);/);
  assert.match(adminFn, /if \(!authorization\.teacher\.isAdministrator\) \{/);
  assert.match(adminFn, /"ADMINISTRATOR_REQUIRED"/);
});

test("does not weaken RLS or use the service-role key for the user-identity check -- createSupabaseRequestClient (anon-key, cookie-scoped) resolves the user; createSupabaseAdminClient is only used after identity is confirmed", () => {
  const requestClientIndex = authorizeFn.indexOf("createSupabaseRequestClient()");
  const adminClientIndex = authorizeFn.indexOf("createSupabaseAdminClient()");
  assert.ok(requestClientIndex > -1 && adminClientIndex > -1 && requestClientIndex < adminClientIndex);
});
