import "server-only";

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkNarrationTranscript } from "@/lib/accessibility/narrationChunking";
import {
  ACCESSIBILITY_DELIVERY_INSTRUCTIONS,
  ACCESSIBILITY_TTS_MODEL,
  type AccessibilityNarrationVoice,
} from "@/lib/accessibility/narrationVoice";
import type { AccessibilityAudioSegment } from "@/lib/supabase/lessonAccessibilityAudio";

export const LESSON_AUDIO_BUCKET = "lesson-audio";
export const LESSON_AUDIO_SIGNED_URL_SECONDS = 5 * 60;

// {subjectId}/{lessonId}/{materialId}/{sourceHash}/segment-NNN.mp3 -- the
// sourceHash segment means a content edit naturally produces a fresh path
// rather than overwriting audio that might still be mid-playback for
// another learner; deleteAccessibilityAudioSegments below cleans up the
// old, now-unreferenced objects once the new transcript/audio replace them.
export function buildAccessibilityAudioSegmentPath(args: {
  subjectId: string;
  lessonId: string;
  materialId: string;
  sourceHash: string;
  index: number;
}): string {
  const segmentNumber = String(args.index + 1).padStart(3, "0");
  return `${args.subjectId}/${args.lessonId}/${args.materialId}/${args.sourceHash}/segment-${segmentNumber}.mp3`;
}

export async function generateAndStoreAccessibilityAudio(args: {
  admin: SupabaseClient;
  subjectId: string;
  lessonId: string;
  materialId: string;
  sourceHash: string;
  voice: AccessibilityNarrationVoice;
  transcript: string;
}): Promise<AccessibilityAudioSegment[]> {
  const chunks = chunkNarrationTranscript(args.transcript);
  if (chunks.length === 0) {
    throw new Error("The narration transcript produced no speakable content.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const segments: AccessibilityAudioSegment[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const response = await openai.audio.speech.create({
      model: ACCESSIBILITY_TTS_MODEL,
      voice: args.voice,
      input: chunks[index],
      instructions: ACCESSIBILITY_DELIVERY_INSTRUCTIONS,
      response_format: "mp3",
    });

    const arrayBuffer = await response.arrayBuffer();
    const storagePath = buildAccessibilityAudioSegmentPath({
      subjectId: args.subjectId,
      lessonId: args.lessonId,
      materialId: args.materialId,
      sourceHash: args.sourceHash,
      index,
    });

    const { error } = await args.admin.storage
      .from(LESSON_AUDIO_BUCKET)
      .upload(storagePath, Buffer.from(arrayBuffer), {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (error) throw error;

    segments.push({ index, storagePath });
  }

  return segments;
}

// Best-effort cleanup of a material's previously stored segments, called
// whenever a fresh transcript/audio replaces them (content edited, or
// audio regenerated). Failures are logged, never thrown -- an orphaned
// storage object is a minor cost cleanup issue, never a reason to fail the
// teacher-facing regeneration action that is already succeeding.
export async function deleteAccessibilityAudioSegments(
  admin: SupabaseClient,
  segments: AccessibilityAudioSegment[],
): Promise<void> {
  if (segments.length === 0) return;

  const { error } = await admin.storage
    .from(LESSON_AUDIO_BUCKET)
    .remove(segments.map((segment) => segment.storagePath));

  if (error) {
    console.warn("Stale accessibility audio cleanup failed:", {
      message: error.message,
      paths: segments.map((segment) => segment.storagePath),
    });
  }
}
