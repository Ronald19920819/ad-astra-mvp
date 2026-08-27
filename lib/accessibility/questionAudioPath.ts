// Pure, DOM/server-free content-addressed storage path construction for
// Stage C question audio. Kept separate from
// lib/kingdom/questionAudioGeneration.ts (which imports "server-only" and
// the OpenAI SDK) so this deterministic logic can be tested directly
// without a browser or server runtime.

import { hashSpokenScript } from "@/lib/accessibility/contentHash";
import { buildQuestionSpeechCacheInput } from "@/lib/accessibility/questionSpeech";
import type {
  AccessibilityNarrationLanguage,
  AccessibilityNarrationVoice,
} from "@/lib/accessibility/narrationVoice";

// Content-addressed: derived from a hash of the exact script + language +
// voice, never from the question ID alone. A question edit (or a future
// per-subject voice change) produces a different script/voice, which
// produces a different hash, which produces a different path -- stale
// audio can never be served, and there is no separate "isStale" boolean
// to maintain anywhere. Namespaced under questions/{questionId}/ purely
// for readability/debuggability in the storage browser; the questionId
// itself plays no role in cache identity.
export function buildQuestionAudioStoragePath(args: {
  questionId: string;
  script: string;
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
}): string {
  const cacheInput = buildQuestionSpeechCacheInput({
    script: args.script,
    language: args.language,
    voice: args.voice,
  });
  const hash = hashSpokenScript(cacheInput);
  return `questions/${args.questionId}/${hash}.mp3`;
}
