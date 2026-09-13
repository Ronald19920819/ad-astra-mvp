import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/learnerProfile.ts transitively imports "server-only" (via
// lib/supabase/server.ts's cookies() usage in some environments and the
// wider server-only Supabase stack) and cannot be invoked directly in a
// plain node:test run -- see lib/supabase/coinLedger.test.ts's header
// comment for the established precedent. These tests verify the real
// source directly.

const SOURCE = readFileSync("lib/supabase/learnerProfile.ts", "utf8");
const targetFn = SOURCE.slice(
  SOURCE.indexOf("const getAuthenticatedLearnerProfileCached = cache(async () => {"),
);

// AD ASTRA -- CENTRAL SUPABASE SESSION REFRESH (proxy.ts): F -- existing
// learner authorization must remain intact, with the same diagnostic
// improvement applied for parity with the teacher-side fix.

test("F: still resolves the user via createSupabaseRequestClient().auth.getUser() -- unchanged authentication path", () => {
  assert.match(targetFn, /const requestClient = await createSupabaseRequestClient\(\);/);
  assert.match(targetFn, /await requestClient\.auth\.getUser\(\);/);
});

test("F: an ordinary unauthenticated learner (no error, no user) still returns null with no logging", () => {
  const errorGateIndex = targetFn.indexOf("if (error) {");
  const logIndex = targetFn.indexOf('await logAuthDiagnostic(\n      "Learner auth resolution failed:",\n      "learner-page.auth"');
  const nullReturnIndex = targetFn.indexOf("if (error || !user) return null;");
  assert.ok(errorGateIndex > -1 && logIndex > -1 && nullReturnIndex > -1);
  assert.ok(errorGateIndex < logIndex && logIndex < nullReturnIndex);
});

test("F: a genuine auth error is logged via the shared logAuthDiagnostic helper with stage 'learner-page.auth', correlatable with the same request's proxy-stage log", () => {
  const logCall = targetFn.match(/await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.auth",\s*\n\s*"auth_get_user_failed",\s*\n\s*error,\s*\n\s*\);/)?.[0];
  assert.ok(logCall, "the auth_get_user_failed logAuthDiagnostic call was not found");
});

test("F: still delegates to loadLearnerProfileForUser -- unchanged", () => {
  assert.match(targetFn, /return loadLearnerProfileForUser\(user\);/);
});

// D -- FOLLOW-UP DIAGNOSTIC IMPROVEMENT: loadLearnerProfileForUser's
// throw/null points are now individually stage-labelled and logged
// (diagnostic classification only -- every throw/return happens exactly
// as before; nothing here changes what the caller receives).

const loadFn = SOURCE.slice(
  SOURCE.indexOf("async function loadLearnerProfileForUser("),
  SOURCE.indexOf("const getAuthenticatedLearnerProfileCached = cache(async () => {"),
);

test("D: a profiles lookup DB error and a genuinely missing profile row are distinguished by stage 'learner-page.profile'", () => {
  assert.match(
    loadFn,
    /if \(profileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.profile",\s*\n\s*"profile_lookup_failed",\s*\n\s*profileError,\s*\n\s*\);\s*\n\s*throw profileError;/,
  );
  assert.match(
    loadFn,
    /if \(!profile\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.profile",\s*\n\s*"profile_not_found",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a learner_profiles lookup DB error is distinguished from an inactive/missing active learner profile, both under stage 'learner-page.learner-profile' -- the exact 'active' status check is unchanged", () => {
  assert.match(
    loadFn,
    /if \(learnerProfileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.learner-profile",\s*\n\s*"learner_profile_lookup_failed",/,
  );
  assert.match(
    loadFn,
    /if \(!learnerProfile \|\| learnerProfile\.status !== "active"\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.learner-profile",\s*\n\s*!learnerProfile \? "learner_profile_not_found" : "learner_profile_inactive",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a subject-enrolment DB error is distinguished under stage 'learner-page.subject-enrolment'", () => {
  assert.match(
    loadFn,
    /if \(enrolmentError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Learner auth resolution failed:",\s*\n\s*"learner-page\.subject-enrolment",\s*\n\s*"subject_enrolment_lookup_failed",/,
  );
});

test("regression: learner_profiles.status must still be 'active' -- unchanged", () => {
  assert.match(loadFn, /!learnerProfile \|\| learnerProfile\.status !== "active"/);
});
