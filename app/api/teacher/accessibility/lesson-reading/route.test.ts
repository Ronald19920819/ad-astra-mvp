import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route imports "server-only" transitively (authorizeTeacher ->
// lib/supabase/teacherAuth.ts -> lib/supabase/server.ts) and cannot be
// invoked directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent. These tests assert structural/security properties of
// the real route source, matching lib/auth/accountRole.test.mjs's style.

const SOURCE = readFileSync(
  "app/api/teacher/accessibility/lesson-reading/route.ts",
  "utf8",
);

test("every accessibility preparation action is gated by authorizeTeacher(subjectId) -- a teacher without that subject's assignment is rejected before any read or write", () => {
  assert.match(SOURCE, /await authorizeTeacher\(subjectId\)/);
  assert.match(SOURCE, /if \(!authorization\.success\)/);
});

test("the route never trusts a client-supplied hash, transcript-status, or approval field for a mutation decision -- it always recomputes currentSourceHash and re-reads canonical status from the database", () => {
  assert.match(SOURCE, /const currentSourceHash = await computeCurrentReadingSourceHash/);
  assert.doesNotMatch(SOURCE, /body\.(sourceHash|isStale|transcriptStatus|approved)/);
});

test("approve-transcript refuses to approve a stale transcript, even if the stored row already says 'generated'", () => {
  const approveBranch = SOURCE.match(
    /if \(body\.action === "approve-transcript"\) \{[\s\S]*?\n {4}\}\n\n {4}if \(body\.action === "generate-audio"\)/,
  )?.[0];
  assert.ok(approveBranch, "approve-transcript branch not found");
  assert.match(approveBranch!, /status\.isStale/);
  assert.match(approveBranch!, /code: "STALE"/);
});

test("generate-audio requires an approved, non-stale transcript before any OpenAI TTS call is made", () => {
  const audioBranch = SOURCE.match(
    /if \(body\.action === "generate-audio"\) \{[\s\S]*$/,
  )?.[0];
  assert.ok(audioBranch, "generate-audio branch not found");
  assert.match(audioBranch!, /status\.row\.transcriptStatus !== "approved"/);
  assert.match(audioBranch!, /status\.isStale/);
  // The gate check happens before generateAndStoreAccessibilityAudio is
  // ever called.
  const gateIndex = audioBranch!.indexOf('code: "STALE"');
  const generateIndex = audioBranch!.indexOf("generateAndStoreAccessibilityAudio(");
  assert.ok(gateIndex > -1 && generateIndex > -1 && gateIndex < generateIndex);
});

test("approval re-validates the transcript's content integrity rather than trusting whatever passed validation at generation time (it may have been hand-edited since)", () => {
  const approveBranch = SOURCE.match(
    /if \(body\.action === "approve-transcript"\) \{[\s\S]*?\n {4}\}\n\n {4}if \(body\.action === "generate-audio"\)/,
  )?.[0];
  assert.match(approveBranch!, /validateAccessibilityNarration\(/);
});

test("a failed OpenAI TTS call is recorded as audio_status 'failed' and returns a teacher-facing message, never raw OpenAI/SDK error detail", () => {
  assert.match(SOURCE, /await markAudioFailed\(/);
  assert.match(SOURCE, /"Audio generation failed. Please try again\."/);
  assert.doesNotMatch(SOURCE, /audioError\.message/);
});

test("the response never includes a raw stored source hash -- only a boolean isStale flag", () => {
  const serializeFn = SOURCE.match(/function serializeStatus[\s\S]*?\n\}\n/)?.[0];
  assert.ok(serializeFn, "serializeStatus not found");
  assert.doesNotMatch(serializeFn!, /sourceHash/);
  assert.match(serializeFn!, /isStale: status\.isStale/);
});

test("regression: every action response (not just GET) carries hasReading -- serializeStatus is the single place that sets it, so no POST action response can omit it and cause AccessibilityAudioCard to unmount itself after a successful action", () => {
  const serializeFn = SOURCE.match(/function serializeStatus[\s\S]*?\n\}\n/)?.[0];
  assert.ok(serializeFn, "serializeStatus not found");
  assert.match(serializeFn!, /hasReading: true/);

  // Every success response in generate-transcript, save-transcript,
  // approve-transcript, and generate-audio spreads serializeStatus(...)
  // directly, rather than constructing its own response object that could
  // omit the field again.
  const actionResponses = SOURCE.match(/Response\.json\(\{\s*success: true,\s*\.\.\.serializeStatus\(/g) ?? [];
  assert.equal(actionResponses.length, 4, "expected all 4 accessibility actions to spread serializeStatus(...)");
});
