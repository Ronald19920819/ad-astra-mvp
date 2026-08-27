import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// This module imports "server-only" and the OpenAI SDK transitively, so
// (matching this repo's established convention -- see
// app/api/live-class/livekit-token/route.test.ts's header comment) it is
// exercised via source inspection rather than a direct import. The
// genuinely pure content-addressing logic it depends on
// (buildQuestionAudioStoragePath) is tested directly and for real in
// lib/accessibility/questionAudioPath.test.ts.

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "questionAudioGeneration.ts"),
  "utf8",
);

test("caching reuses the existing Stage B private lesson-audio bucket and signed-URL constants -- no second storage/provider layer is introduced", () => {
  assert.match(SOURCE, /LESSON_AUDIO_BUCKET/);
  assert.match(SOURCE, /LESSON_AUDIO_SIGNED_URL_SECONDS/);
  assert.match(SOURCE, /from "@\/lib\/kingdom\/accessibilityAudioGeneration"/);
});

test("the storage path is delegated to the pure, separately-tested buildQuestionAudioStoragePath helper -- no ad hoc path construction here", () => {
  assert.match(SOURCE, /import \{ buildQuestionAudioStoragePath \} from "@\/lib\/accessibility\/questionAudioPath";/);
  assert.match(SOURCE, /const storagePath = buildQuestionAudioStoragePath\(args\);/);
});

test("a cache hit (an existing signed URL can be created) never calls the OpenAI TTS API", () => {
  const cacheHitBranch = SOURCE.match(
    /if \(!existing\.error && existing\.data\?\.signedUrl\) \{[\s\S]*?\n  \}/,
  )?.[0];
  assert.ok(cacheHitBranch, "cache-hit branch not found");
  assert.doesNotMatch(cacheHitBranch!, /openai|OpenAI/);
});

test("generation uses the Stage C neutral assessment-reader delivery instruction, not Stage B's lesson-narration instruction", () => {
  assert.match(SOURCE, /ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS/);
  assert.doesNotMatch(SOURCE, /ACCESSIBILITY_DELIVERY_INSTRUCTIONS/);
});

test("upload is upsert:false -- a content-addressed path is only ever written once, so an unexpected overwrite would indicate a real bug rather than something to silently allow", () => {
  assert.match(SOURCE, /upsert: false/);
});

test("a benign concurrent-upload race (two learners triggering generation of the identical never-before-heard question at the same moment) is tolerated, never surfaced as a failure", () => {
  assert.match(SOURCE, /isBenignConcurrentUploadError/);
  assert.match(SOURCE, /already exists\|duplicate/);
});

test("the confirmed v1 TTS model is used for question audio, same as lesson narration", () => {
  assert.match(SOURCE, /ACCESSIBILITY_TTS_MODEL/);
});
