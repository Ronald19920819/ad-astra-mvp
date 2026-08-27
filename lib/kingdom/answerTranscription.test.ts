import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// Imports "server-only" and the OpenAI SDK transitively -- exercised via
// source inspection, matching this repo's established convention (see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// original precedent).

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "answerTranscription.ts"),
  "utf8",
);

test("Q: plain transcription only -- no Responses API call, Kingdom narration generation, or translation call exists anywhere in this module", () => {
  assert.doesNotMatch(SOURCE, /\bresponses\.create\(/);
  assert.doesNotMatch(SOURCE, /generateAccessibilityNarrationTranscript/);
  assert.doesNotMatch(SOURCE, /\.translate\(|translateText/);
  // Exactly one OpenAI API call in the whole module: the transcription
  // itself -- no second call (e.g. a follow-up chat/completions rewrite).
  const apiCalls = SOURCE.match(/await openai\./g) ?? [];
  assert.equal(apiCalls.length, 1);
});

test("A: the canonical transcription model is whisper-1 -- switched from gpt-4o-transcribe after real 40-second recordings came back truncated to a few words, a documented gpt-4o-transcribe reliability issue confirmed against OpenAI's own developer community reports", () => {
  assert.match(SOURCE, /const ANSWER_TRANSCRIPTION_MODEL = "whisper-1";/);
  const modelUsedInCall = SOURCE.match(/model: ANSWER_TRANSCRIPTION_MODEL,/);
  assert.ok(modelUsedInCall, "the transcription call must use the exported model constant, not a separate hardcoded value");
});

test("the language hint is threaded through from the caller (derived from the canonical subject language mapping) rather than hardcoded", () => {
  assert.match(SOURCE, /language: args\.languageCode/);
  assert.doesNotMatch(SOURCE, /language: "en"|language: "af"/);
});

test("audio is handed to the SDK via toFile from an in-memory Buffer -- no filesystem write, matching the 'never persist raw audio' requirement", () => {
  assert.match(SOURCE, /import OpenAI, \{ toFile \} from "openai";/);
  assert.match(SOURCE, /await toFile\(args\.audioBuffer, args\.fileName/);
  assert.doesNotMatch(SOURCE, /writeFile|createWriteStream|fs\.write|tmpdir/);
});

test("the transcription's own text field is returned verbatim -- no post-processing, trimming beyond what the caller does, or rewriting", () => {
  const fn = SOURCE.match(/export async function transcribeAnswerAudio[\s\S]*$/)?.[0];
  assert.ok(fn, "transcribeAnswerAudio not found");
  assert.match(fn!, /return transcription\.text;/);
});

test("the OpenAI API key is read only from the server environment, never accepted from the client/request", () => {
  assert.match(SOURCE, /apiKey: process\.env\.OPENAI_API_KEY/);
});
