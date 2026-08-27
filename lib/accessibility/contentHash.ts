import { createHash } from "node:crypto";

// Deterministic content-version hashing. A stored accessibility transcript
// or audio segment is only ever considered current when its stored hash
// still equals a freshly computed hash of the LIVE authoritative reading --
// see lib/supabase/lessonAccessibilityAudio.ts's isStale derivation. Never
// stored as a cached "isStale" boolean; always recomputed at read time.
export function hashReadingContentText(contentText: string): string {
  return createHash("sha256").update(contentText, "utf8").digest("hex");
}

export function hashPdfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Stage C (question audio): hashes the deterministic spoken-script cache
// input (see lib/accessibility/questionSpeech.ts's
// buildQuestionSpeechCacheInput, which already binds language+voice into
// the string) into the content-addressed identity used for the question
// audio storage path -- a question edit (or a language/voice change)
// changes the input string, which changes this hash, which naturally
// invalidates any previously cached audio without needing a separate
// "isStale" flag anywhere.
export function hashSpokenScript(cacheInput: string): string {
  return createHash("sha256").update(cacheInput, "utf8").digest("hex");
}
