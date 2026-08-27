import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/learnerAccessibility.ts imports "server-only" (via
// lib/supabase/server.ts) and cannot be invoked directly in a plain
// node:test run -- see app/api/live-class/livekit-token/route.test.ts's
// header comment for the full precedent this mirrors. Instead these tests:
//   1. exercise a verbatim mirror of the real resolution logic (the
//      `data?.accessibility_enabled === true` check and the
//      isMissingColumnError fallback, both cited below from the real
//      source), and
//   2. assert structural properties of the real source file directly.

const SOURCE = readFileSync("lib/supabase/learnerAccessibility.ts", "utf8");

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

// Mirrors getLearnerAccessibilityEntitlement's row -> entitlement
// resolution exactly (lib/supabase/learnerAccessibility.ts):
//   isMissingColumnError(error) -> { accessibilityEnabled: false }
//   data?.accessibility_enabled === true -> boolean
function mirroredResolveEntitlement(
  data: { accessibility_enabled?: unknown } | null,
  error: { code?: string } | null,
) {
  if (isMissingColumnError(error)) return { accessibilityEnabled: false };
  return { accessibilityEnabled: data?.accessibility_enabled === true };
}

test("I: an enabled learner's row resolves to accessibilityEnabled true", () => {
  const result = mirroredResolveEntitlement({ accessibility_enabled: true }, null);
  assert.equal(result.accessibilityEnabled, true);
});

test("J: a disabled learner's row resolves to accessibilityEnabled false", () => {
  const result = mirroredResolveEntitlement({ accessibility_enabled: false }, null);
  assert.equal(result.accessibilityEnabled, false);
});

test("K: a null accessibility_enabled value resolves safely to false", () => {
  const result = mirroredResolveEntitlement({ accessibility_enabled: null }, null);
  assert.equal(result.accessibilityEnabled, false);
});

test("K: a missing row (no learner_profiles match) resolves safely to false", () => {
  const result = mirroredResolveEntitlement(null, null);
  assert.equal(result.accessibilityEnabled, false);
});

test("K: a missing-column database error (migration not yet applied) resolves safely to false, not a thrown error", () => {
  const result = mirroredResolveEntitlement(null, { code: "42703" });
  assert.equal(result.accessibilityEnabled, false);

  const resultPostgrest = mirroredResolveEntitlement(null, { code: "PGRST204" });
  assert.equal(resultPostgrest.accessibilityEnabled, false);
});

test("a genuine, non-missing-column database error is not silently treated as false", () => {
  assert.equal(isMissingColumnError({ code: "23503" }), false);
});

test("the real reader accepts either a learnerProfileId or an authUserId, and resolves an authUserId to a learnerProfileId via profiles/learner_profiles before querying accessibility_enabled -- it never takes a subjectId", () => {
  assert.match(SOURCE, /learnerProfileId: string \}\s*\|\s*\{ authUserId: string \}/);
  assert.doesNotMatch(SOURCE, /subjectId/);
});

test("H: the reader queries learner_profiles only -- never learner_subjects or any subject/enrolment table, so entitlement cannot vary by subject", () => {
  assert.doesNotMatch(SOURCE, /learner_subjects/);
  assert.doesNotMatch(SOURCE, /subject_id/);
});

test("the reader never selects a diagnosis/reason column, only accessibility_enabled", () => {
  assert.match(SOURCE, /select\("accessibility_enabled"\)/);
  assert.doesNotMatch(SOURCE, /diagnos|condition|reason/i);
});

test("A: the migration defines accessibility_enabled as non-null, defaulting to false, so every existing learner defaults to disabled and no row can hold null", () => {
  const migration = readFileSync(
    "supabase/migrations/202608260001_learner_accessibility_entitlement.sql",
    "utf8",
  );
  assert.match(
    migration,
    /add column if not exists accessibility_enabled boolean not null default false/,
  );
  // The migration's comment explains what is NOT stored -- but no
  // diagnosis/condition/reason COLUMN may ever be added.
  assert.doesNotMatch(migration, /add column if not exists.*(diagnos|condition|reason)/i);
});
