import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionAudioStoragePath } from "./questionAudioPath";

test("K: the storage path is content-addressed -- an identical script+language+voice always produces the same path (cache hit), letting a replay reuse stored audio without regenerating it", () => {
  const args = {
    questionId: "11111111-1111-4111-8111-111111111111",
    script: "Which of the following is an example of primary research?",
    language: "english" as const,
    voice: "cedar" as const,
  };
  assert.equal(buildQuestionAudioStoragePath(args), buildQuestionAudioStoragePath(args));
});

test("K: a changed script (e.g. an edited question) produces a different storage path -- stale audio is never reused", () => {
  const base = {
    questionId: "11111111-1111-4111-8111-111111111111",
    language: "english" as const,
    voice: "cedar" as const,
  };
  const before = buildQuestionAudioStoragePath({ ...base, script: "Original question text?" });
  const after = buildQuestionAudioStoragePath({ ...base, script: "Edited question text?" });
  assert.notEqual(before, after);
});

test("a different voice or language for the identical script also produces a different storage path", () => {
  const base = {
    questionId: "11111111-1111-4111-8111-111111111111",
    script: "Same script.",
  };
  const cedarEnglish = buildQuestionAudioStoragePath({ ...base, language: "english", voice: "cedar" });
  const marinAfrikaans = buildQuestionAudioStoragePath({ ...base, language: "afrikaans", voice: "marin" });
  assert.notEqual(cedarEnglish, marinAfrikaans);
});

test("two different question IDs with identical script/language/voice still produce different paths, since the questionId is part of the path namespace", () => {
  const a = buildQuestionAudioStoragePath({
    questionId: "11111111-1111-4111-8111-111111111111",
    script: "Same script.",
    language: "english",
    voice: "cedar",
  });
  const b = buildQuestionAudioStoragePath({
    questionId: "22222222-2222-4222-8222-222222222222",
    script: "Same script.",
    language: "english",
    voice: "cedar",
  });
  assert.notEqual(a, b);
});

test("the storage path is namespaced under questions/{questionId}/ so it can never collide with Stage B's lesson-reading segment paths", () => {
  const storagePath = buildQuestionAudioStoragePath({
    questionId: "11111111-1111-4111-8111-111111111111",
    script: "A question.",
    language: "english",
    voice: "cedar",
  });
  assert.match(storagePath, /^questions\/11111111-1111-4111-8111-111111111111\/[0-9a-f]{64}\.mp3$/);
});
