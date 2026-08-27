import type { SubjectFamilyKey } from "@/lib/subjects/subjectConfig";

// v1 accessibility TTS choices. Kept in exactly one place so a future
// voice/provider change never requires touching learner entitlement data
// (lib/supabase/learnerAccessibility.ts) or lesson content.
export const ACCESSIBILITY_TTS_MODEL = "gpt-4o-mini-tts";

export const ACCESSIBILITY_DELIVERY_INSTRUCTIONS =
  "Speak as a calm, warm secondary-school teacher. Use clear pronunciation " +
  "and a natural educational pace. Do not sound theatrical or like an " +
  "advertisement. Pause naturally between paragraphs and give slightly " +
  "greater emphasis to instructions telling the learner to pause or " +
  "examine a source.";

// Stage C (question audio): a deliberately more neutral delivery than
// lesson narration -- this is an assessment reader, not a storyteller.
// Never explains, interprets, hints at, or emphasises any answer option;
// see lib/accessibility/questionSpeech.ts for the deterministic script
// this instruction is applied to.
export const ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS =
  "Speak clearly and calmly as a secondary-school assessment reader. Read " +
  "the question exactly and naturally. Use a steady pace and clear pauses " +
  "between the question and answer options. Do not explain, interpret, " +
  "hint at, or emphasise any answer.";

export type AccessibilityNarrationLanguage = "english" | "afrikaans";
export type AccessibilityNarrationVoice = "cedar" | "marin";

// Voice is derived from the subject's existing familyKey -- language-driven,
// not duplicated per subject page. Every non-Afrikaans family (business
// studies, english, history) is English-medium in this app.
export function getAccessibilityNarrationVoice(
  familyKey: SubjectFamilyKey,
): {
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
} {
  if (familyKey === "afrikaans") {
    return { language: "afrikaans", voice: "marin" };
  }
  return { language: "english", voice: "cedar" };
}

// Stage D (Record Answer / speech-to-text): the ISO-639-1 hint OpenAI's
// transcription API accepts. Derived from the SAME canonical
// language/voice decision as TTS above -- never a second, page-level
// language mapping. Passing this hint improves transcription accuracy
// and never translates: Afrikaans speech is still returned as Afrikaans
// text, English speech as English text.
export function toTranscriptionLanguageCode(
  language: AccessibilityNarrationLanguage,
): "en" | "af" {
  return language === "afrikaans" ? "af" : "en";
}
