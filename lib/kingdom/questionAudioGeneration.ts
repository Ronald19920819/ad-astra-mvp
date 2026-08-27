import "server-only";

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildQuestionAudioStoragePath } from "@/lib/accessibility/questionAudioPath";
import {
  ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS,
  ACCESSIBILITY_TTS_MODEL,
  type AccessibilityNarrationLanguage,
  type AccessibilityNarrationVoice,
} from "@/lib/accessibility/narrationVoice";
import {
  LESSON_AUDIO_BUCKET,
  LESSON_AUDIO_SIGNED_URL_SECONDS,
} from "@/lib/kingdom/accessibilityAudioGeneration";

// Stage C ("Listen to Question") caching strategy: no new table -- see
// lib/accessibility/questionAudioPath.ts's buildQuestionAudioStoragePath
// (the actual content-addressing logic, kept pure and separately
// testable) for how the cache key is derived. The cache is shared across
// every entitled learner (not per-learner), so even the very first
// generation of a given question's audio only ever happens once,
// globally, no matter how many learners later listen to it.

function isBenignConcurrentUploadError(message: string | undefined | null): boolean {
  return Boolean(message) && /already exists|duplicate/i.test(message!);
}

// THE single entry point a learner-facing question-audio route calls.
// Reuses the existing private lesson-audio bucket and signed-URL pattern
// from Stage B (lib/kingdom/accessibilityAudioGeneration.ts) rather than
// introducing a second storage/provider layer. Cache hit: one signed-URL
// call, no OpenAI request at all. Cache miss: generates once (this exact
// script has never been spoken before, by any learner), uploads to the
// content-addressed path, then signs it.
export async function getOrGenerateQuestionAudioUrl(args: {
  admin: SupabaseClient;
  questionId: string;
  script: string;
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
}): Promise<string> {
  const storagePath = buildQuestionAudioStoragePath(args);

  const existing = await args.admin.storage
    .from(LESSON_AUDIO_BUCKET)
    .createSignedUrl(storagePath, LESSON_AUDIO_SIGNED_URL_SECONDS);

  if (!existing.error && existing.data?.signedUrl) {
    return existing.data.signedUrl;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.audio.speech.create({
    model: ACCESSIBILITY_TTS_MODEL,
    voice: args.voice,
    input: args.script,
    instructions: ACCESSIBILITY_QUESTION_DELIVERY_INSTRUCTIONS,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await args.admin.storage
    .from(LESSON_AUDIO_BUCKET)
    .upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: "audio/mpeg",
      // Content-addressed: this exact path is only ever written once, so
      // there is nothing to intentionally overwrite. upsert stays false
      // so a real corruption/mismatch would surface as an error rather
      // than silently replacing content -- the one exception is a benign
      // concurrent-request race, handled below.
      upsert: false,
    });

  if (uploadError && !isBenignConcurrentUploadError(uploadError.message)) {
    throw uploadError;
  }

  const signed = await args.admin.storage
    .from(LESSON_AUDIO_BUCKET)
    .createSignedUrl(storagePath, LESSON_AUDIO_SIGNED_URL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error("Signed question audio access could not be created.");
  }

  return signed.data.signedUrl;
}
