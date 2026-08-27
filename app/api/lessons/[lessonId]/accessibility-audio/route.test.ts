import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// This route imports "server-only" transitively and cannot be invoked
// directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent. Path resolved relative to this file's own location
// (not process.cwd()) since its directory name contains a
// glob-metacharacter bracket ([lessonId]) -- see
// app/api/administrator/learners/[learnerId]/accessibility/route.test.ts
// for the same issue and scripts/run-accessibility-route-test.mjs for the
// CLI-invocation workaround this file also needs.

const routeSourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "route.ts",
);
const SOURCE = readFileSync(routeSourcePath, "utf8");

test("A learner audio request is authenticated via the real session -- never a client-supplied learner ID", () => {
  assert.match(SOURCE, /requestClient\.auth\.getUser\(\)/);
  assert.doesNotMatch(SOURCE, /searchParams\.get\("(learnerId|authUserId|userId)"\)/);
});

test("B/entitlement: the route checks getLearnerAccessibilityEntitlement and rejects a non-entitled learner with 403 before ever computing or serving audio", () => {
  assert.match(SOURCE, /getLearnerAccessibilityEntitlement\(\{\s*authUserId: user\.id,?\s*\}\)/);
  assert.match(SOURCE, /if \(!entitlement\.accessibilityEnabled\)/);

  const entitlementCheckIndex = SOURCE.indexOf("entitlement.accessibilityEnabled");
  const audioLookupIndex = SOURCE.indexOf("getLearnerAccessibilityAudio(");
  assert.ok(entitlementCheckIndex > -1 && audioLookupIndex > -1);
  assert.ok(entitlementCheckIndex < audioLookupIndex);
});

test("subject enrolment access is verified via the canonical verifyLearnerSubjectAccess helper -- not re-implemented here", () => {
  assert.match(SOURCE, /verifyLearnerSubjectAccess\(user\.id, lesson\.subject_id\)/);
});

test("K: staleness is re-derived from the live reading on every request via computeCurrentReadingSourceHash -- never trusted from a prior response or cache", () => {
  assert.match(SOURCE, /computeCurrentReadingSourceHash\(/);
  assert.match(SOURCE, /getLearnerAccessibilityAudio\(\{/);
});

test("audio URLs are always short-lived signed URLs from the private bucket, never a public/raw storage path", () => {
  assert.match(SOURCE, /createSignedUrl\(segment\.storagePath, LESSON_AUDIO_SIGNED_URL_SECONDS\)/);
  assert.doesNotMatch(SOURCE, /getPublicUrl/);
});

test("the only lesson_materials query filters by material_type 'reading' -- quiz/video materials can never be served as accessibility audio", () => {
  assert.match(SOURCE, /\.eq\("material_type", "reading"\)/);
});

test("only a published lesson's reading can ever be served to a learner", () => {
  assert.match(SOURCE, /lesson\.status !== "published"/);
});

test("a ready response includes sourceVersion (the current source hash) so the client can detect a regenerated/re-approved recording and never apply an old saved playback position to it", () => {
  assert.match(SOURCE, /sourceVersion: currentSourceHash,/);
});
