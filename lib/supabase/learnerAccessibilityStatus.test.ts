import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// Imports "server-only" transitively -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// established source-inspection precedent this file follows.
const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "learnerAccessibilityStatus.ts"),
  "utf8",
);

test("this is a thin SSR wrapper -- it delegates to the Stage A canonical entitlement reader rather than re-implementing or duplicating entitlement logic", () => {
  assert.match(SOURCE, /getLearnerAccessibilityEntitlement\(\{\s*authUserId: user\.id,?\s*\}\)/);
  assert.match(SOURCE, /from "@\/lib\/supabase\/learnerAccessibility"/);
});

test("an unauthenticated request resolves to disabled (both the flat flag and every capability) rather than throwing", () => {
  const unauthBlock = SOURCE.match(/if \(!user\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(unauthBlock, "unauthenticated branch not found");
  assert.match(unauthBlock!, /accessibilityEnabled: false,/);
  assert.match(unauthBlock!, /capabilities: \{ questionAudio: false, recordAnswer: false \},/);
});

test("STAGE E section 10: capabilities are named per-accommodation (questionAudio, recordAnswer) rather than a single boolean threaded everywhere -- for v1 both mirror the same global entitlement, but only this function would need to change to separate them later", () => {
  assert.match(SOURCE, /export type LearnerAccessibilityCapabilities = \{\s*questionAudio: boolean;\s*recordAnswer: boolean;\s*\};/);
  assert.match(
    SOURCE,
    /capabilities: \{ questionAudio: accessibilityEnabled, recordAnswer: accessibilityEnabled \},/,
  );
});

test("identity comes solely from the real authenticated session -- never a client-supplied learner ID", () => {
  assert.match(SOURCE, /requestClient\.auth\.getUser\(\)/);
  assert.doesNotMatch(SOURCE, /searchParams|request\.(json|body)/);
});
