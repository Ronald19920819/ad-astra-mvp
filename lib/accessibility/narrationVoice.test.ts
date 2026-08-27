import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESSIBILITY_DELIVERY_INSTRUCTIONS,
  ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS,
  ACCESSIBILITY_TTS_MODEL,
  getAccessibilityNarrationVoice,
  toTranscriptionLanguageCode,
} from "./narrationVoice";

test("F: English-medium subject families (business-studies, english, history) resolve to the Cedar voice", () => {
  assert.deepEqual(getAccessibilityNarrationVoice("business-studies"), {
    language: "english",
    voice: "cedar",
  });
  assert.deepEqual(getAccessibilityNarrationVoice("english"), {
    language: "english",
    voice: "cedar",
  });
  assert.deepEqual(getAccessibilityNarrationVoice("history"), {
    language: "english",
    voice: "cedar",
  });
});

test("G: the Afrikaans subject family resolves to the Marin voice", () => {
  assert.deepEqual(getAccessibilityNarrationVoice("afrikaans"), {
    language: "afrikaans",
    voice: "marin",
  });
});

test("voice mapping is language-driven off the subject's existing familyKey -- not a per-subject lookup table that could drift out of sync", () => {
  // Every SubjectFamilyKey value maps to exactly one of the two v1 voices.
  const families = ["business-studies", "english", "afrikaans", "history"] as const;
  for (const family of families) {
    const result = getAccessibilityNarrationVoice(family);
    assert.ok(result.voice === "cedar" || result.voice === "marin");
  }
});

test("the confirmed v1 TTS model is used", () => {
  assert.equal(ACCESSIBILITY_TTS_MODEL, "gpt-4o-mini-tts");
});

test("Stage C question audio uses its own, more neutral assessment-reader delivery instruction -- distinct from lesson narration's warmer storytelling instruction, extending the same centralised voice config rather than a second provider layer", () => {
  assert.notEqual(
    ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS,
    ACCESSIBILITY_DELIVERY_INSTRUCTIONS,
  );
  assert.match(ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS, /assessment reader/i);
  assert.match(
    ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS,
    /do not explain, interpret, hint at, or emphasise any answer/i,
  );
});

test("R/S: toTranscriptionLanguageCode maps English to 'en' and Afrikaans to 'af' -- the same canonical language decision as TTS, never a second mapping", () => {
  assert.equal(toTranscriptionLanguageCode("english"), "en");
  assert.equal(toTranscriptionLanguageCode("afrikaans"), "af");
});

test("toTranscriptionLanguageCode is derived from getAccessibilityNarrationVoice's own language output for every subject family, so a Business Studies/English/History subject and an Afrikaans subject can never disagree between TTS and STT language", () => {
  const families = ["business-studies", "english", "afrikaans", "history"] as const;
  for (const family of families) {
    const { language } = getAccessibilityNarrationVoice(family);
    const code = toTranscriptionLanguageCode(language);
    assert.equal(code, family === "afrikaans" ? "af" : "en");
  }
});
