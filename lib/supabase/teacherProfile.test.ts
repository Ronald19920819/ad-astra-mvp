import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/teacherProfile.ts imports "server-only" and cannot be
// invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("lib/supabase/teacherProfile.ts", "utf8");
// getAuthenticatedTeacherProfile is the last declaration before
// getAuthenticatedTeacherProfileDashboard -- sliced to that boundary
// rather than end-of-file since another export follows it.
const targetFn = SOURCE.slice(
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfile("),
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfileDashboard("),
);

// AD ASTRA -- CENTRAL SUPABASE SESSION REFRESH (proxy.ts): E -- existing
// teacher profile resolution must remain intact.

test("E: still resolves the user via createSupabaseRequestClient().auth.getUser() before loading the profile", () => {
  assert.match(targetFn, /const requestClient = await createSupabaseRequestClient\(\);/);
  assert.match(targetFn, /await requestClient\.auth\.getUser\(\);/);
});

test("E: an ordinary unauthenticated caller (no error, no user) still returns null with no logging -- not every null result is a failure", () => {
  const nullReturnIndex = targetFn.indexOf("if (error || !user) return null;");
  const logIndex = targetFn.indexOf('await logAuthDiagnostic(\n      "Teacher auth resolution failed:",\n      "teacher-page.auth"');
  assert.ok(nullReturnIndex > -1 && logIndex > -1);
  // The log is gated on `if (error)` alone, strictly before the combined
  // `error || !user` null-return -- so a bare missing user with no error
  // never reaches the logAuthDiagnostic call.
  const errorGateIndex = targetFn.indexOf("if (error) {");
  assert.ok(errorGateIndex > -1 && errorGateIndex < logIndex && logIndex < nullReturnIndex);
});

test("E: a genuine auth error is logged via the shared logAuthDiagnostic helper with stage 'teacher-page.auth', correlatable with the same request's proxy-stage log", () => {
  const logCall = targetFn.match(/await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.auth",\s*\n\s*"auth_get_user_failed",\s*\n\s*error,\s*\n\s*\);/)?.[0];
  assert.ok(logCall, "the auth_get_user_failed logAuthDiagnostic call was not found");
});

test("E: still delegates to loadTeacherProfileForUser for the actual profile/assignment lookup -- unchanged", () => {
  assert.match(targetFn, /return loadTeacherProfileForUser\(user\);/);
});

// D -- FOLLOW-UP DIAGNOSTIC IMPROVEMENT: loadTeacherProfileForUser's
// throw/null points are now individually stage-labelled and logged
// (diagnostic classification only -- every throw/return still happens
// exactly as before; nothing here changes what the caller receives).

const loadFn = SOURCE.slice(
  SOURCE.indexOf("async function loadTeacherProfileForUser("),
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfile("),
);

test("D: a profiles lookup DB error and a genuinely missing profile row are distinguished by stage 'teacher-page.profile', with the pre-existing throw/null-return preserved exactly", () => {
  assert.match(
    loadFn,
    /if \(profileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_lookup_failed",\s*\n\s*profileError,\s*\n\s*\);\s*\n\s*throw profileError;/,
  );
  assert.match(
    loadFn,
    /if \(!profile\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_not_found",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a teacher_profiles lookup DB error is distinguished from an inactive/missing active teacher profile, both under stage 'teacher-page.teacher-profile' -- the exact 'active' status check is unchanged", () => {
  assert.match(
    loadFn,
    /if \(teacherProfileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*"teacher_profile_lookup_failed",\s*\n\s*teacherProfileError,/,
  );
  assert.match(
    loadFn,
    /if \(!teacherProfile \|\| teacherProfile\.status !== "active"\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*!teacherProfile \? "teacher_profile_not_found" : "teacher_profile_inactive",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a subject-assignment (assignedSubjects) DB error is distinguished under stage 'teacher-page.subject-assignment'", () => {
  assert.match(
    loadFn,
    /if \(assignmentError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.subject-assignment",\s*\n\s*"subject_assignment_lookup_failed",\s*\n\s*assignmentError,/,
  );
});

test("regression: teacher_profiles.status must still be 'active' and teacher_subjects assignment status must still be 'active' for assignedSubjects", () => {
  assert.match(loadFn, /!teacherProfile \|\| teacherProfile\.status !== "active"/);
  assert.match(loadFn, /\.eq\("teacher_profile_id", teacherProfile\.id\)\s*\n\s*\.eq\("status", "active"\);/);
});
