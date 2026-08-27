import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// This route imports "server-only" (via authorizeAdministrator ->
// lib/supabase/teacherAuth.ts -> lib/supabase/server.ts) and cannot be
// invoked directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent this mirrors. Instead these tests:
//   1. exercise a verbatim mirror of the route's own update-payload logic,
//      and
//   2. assert structural/security properties of the real route source
//      directly, matching lib/auth/accountRole.test.mjs's established
//      style of reading real source files and regex-asserting invariants.

// Resolved relative to this test file's own location (not process.cwd())
// so it works regardless of the working directory `node --test` is
// invoked from -- CWD-relative resolution is awkward here since this
// route's directory name contains glob-metacharacter brackets ([learnerId]).
const routeSourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "route.ts",
);
const SOURCE = readFileSync(routeSourcePath, "utf8");

// Mirrors the route's request-body -> update-payload logic exactly.
function mirroredBuildUpdatePayload(enabled: unknown) {
  if (typeof enabled !== "boolean") {
    throw new Error("A boolean 'enabled' value is required.");
  }
  return { accessibility_enabled: enabled };
}

test("B: an administrator enabling accessibility produces { accessibility_enabled: true }", () => {
  assert.deepEqual(mirroredBuildUpdatePayload(true), {
    accessibility_enabled: true,
  });
});

test("C: an administrator disabling accessibility produces { accessibility_enabled: false }", () => {
  assert.deepEqual(mirroredBuildUpdatePayload(false), {
    accessibility_enabled: false,
  });
});

test("a non-boolean enabled value is rejected rather than coerced", () => {
  assert.throws(() => mirroredBuildUpdatePayload("true"));
  assert.throws(() => mirroredBuildUpdatePayload(1));
  assert.throws(() => mirroredBuildUpdatePayload(undefined));
  assert.throws(() => mirroredBuildUpdatePayload(null));
});

test("D & E: the route gates its mutation on authorizeAdministrator(), not on bare authorizeTeacher() success -- so an active but non-administrator teacher is rejected before any update runs", () => {
  assert.match(SOURCE, /await authorizeAdministrator\(\)/);
  // authorizeAdministrator() itself is defined to require
  // isAdministrator === true (lib/supabase/teacherAuth.ts) -- this route
  // must rely on that function's success flag, not re-derive its own
  // weaker check.
  assert.doesNotMatch(SOURCE, /await authorizeTeacher\(/);
  assert.match(SOURCE, /if \(!authorization\.success\)/);
});

test("F & G: the route establishes identity solely from the authenticated server session -- it never reads a caller-supplied identity, role, or administrator flag out of the request body", () => {
  // The only field ever read off the parsed body is `enabled`.
  const bodyFieldReads = SOURCE.match(/body as Record<string, unknown>\)\.(\w+)/g) ?? [];
  assert.deepEqual(bodyFieldReads, ["body as Record<string, unknown>).enabled"]);
  assert.doesNotMatch(SOURCE, /body\.(isAdministrator|role|learnerId|authUserId)/);
});

test("the learnerId route param identifies which learner_profiles row to change, and is validated as a UUID before use -- it is never trusted as the caller's own identity", () => {
  assert.match(SOURCE, /uuidPattern\.test\(learnerId\)/);
  assert.match(SOURCE, /const authorization = await authorizeAdministrator\(\)/);
});

test("L: the route touches only learner_profiles.accessibility_enabled -- it never queries an XP, AC/Coin, enrolment, submission, or lesson-completion table", () => {
  assert.match(SOURCE, /accessibility_enabled/);
  // Every table this route actually touches, cited from a .from("...") call.
  const fromCalls = SOURCE.match(/\.from\("(\w+)"\)/g) ?? [];
  assert.deepEqual(
    Array.from(new Set(fromCalls)),
    ['.from("learner_profiles")'],
  );
});

test("the route never selects or writes a diagnosis/condition/reason field", () => {
  assert.doesNotMatch(SOURCE, /diagnos|condition|reason/i);
});
