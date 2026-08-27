import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPdfBytes, hashReadingContentText } from "@/lib/accessibility/contentHash";
import {
  isLessonReadingPdfPath,
  LESSON_READING_PDF_BUCKET,
} from "@/lib/lessons/pdfReading";
import type {
  AccessibilityNarrationLanguage,
  AccessibilityNarrationVoice,
} from "@/lib/accessibility/narrationVoice";

// Canonical reader/writer for lesson_accessibility_audio
// (202608260002_lesson_accessibility_audio.sql). One current row per
// reading material. Staleness is NEVER stored -- every caller here either
// receives it freshly computed (getAccessibilityAudioStatus) or has it
// checked as a hard gate (getLearnerAccessibilityAudio).

export type AccessibilityAudioSegment = {
  index: number;
  storagePath: string;
};

export type AccessibilityTranscriptStatus =
  | "not_prepared"
  | "generated"
  | "approved";
export type AccessibilityAudioGenerationStatus =
  | "not_generated"
  | "generating"
  | "ready"
  | "failed";

export type AccessibilityAudioRow = {
  id: string;
  lessonMaterialId: string;
  lessonId: string;
  subjectId: string;
  sourceType: "pasted_text" | "pdf";
  sourceHash: string;
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
  transcript: string | null;
  transcriptStatus: AccessibilityTranscriptStatus;
  validationNotes: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  audioStatus: AccessibilityAudioGenerationStatus;
  audioSegments: AccessibilityAudioSegment[];
  audioGeneratedAt: string | null;
  updatedAt: string;
};

export type AccessibilityAudioStatus = {
  row: AccessibilityAudioRow | null;
  currentSourceHash: string;
  isStale: boolean;
};

type RawRow = {
  id: string;
  lesson_material_id: string;
  lesson_id: string;
  subject_id: string;
  source_type: "pasted_text" | "pdf";
  source_hash: string;
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
  transcript: string | null;
  transcript_status: AccessibilityTranscriptStatus;
  validation_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  audio_status: AccessibilityAudioGenerationStatus;
  audio_segments: unknown;
  audio_generated_at: string | null;
  updated_at: string;
};

function normalizeSegments(value: unknown): AccessibilityAudioSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.index !== "number" ||
      typeof candidate.storagePath !== "string"
    ) {
      return [];
    }
    return [{ index: candidate.index, storagePath: candidate.storagePath }];
  });
}

function mapRow(row: RawRow): AccessibilityAudioRow {
  return {
    id: row.id,
    lessonMaterialId: row.lesson_material_id,
    lessonId: row.lesson_id,
    subjectId: row.subject_id,
    sourceType: row.source_type,
    sourceHash: row.source_hash,
    language: row.language,
    voice: row.voice,
    transcript: row.transcript,
    transcriptStatus: row.transcript_status,
    validationNotes: row.validation_notes,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    audioStatus: row.audio_status,
    audioSegments: normalizeSegments(row.audio_segments),
    audioGeneratedAt: row.audio_generated_at,
    updatedAt: row.updated_at,
  };
}

// The one place that decides what "current" means for a reading's content
// version -- pasted_text hashes the stored structured-reading content_text
// directly (already a deterministic JSON string); pdf downloads and hashes
// the actual stored PDF bytes (never a text extraction, matching this
// app's PDF architecture).
export async function computeCurrentReadingSourceHash(args: {
  admin: SupabaseClient;
  sourceType: "pasted_text" | "pdf";
  contentText: string | null;
  contentUrl: string | null;
  subjectId: string;
  lessonId: string;
}): Promise<string> {
  if (args.sourceType === "pasted_text") {
    return hashReadingContentText(args.contentText ?? "");
  }

  if (
    !args.contentUrl ||
    !isLessonReadingPdfPath(args.contentUrl, args.subjectId, args.lessonId)
  ) {
    throw new Error("The saved PDF reading could not be resolved securely.");
  }

  const { data: pdfBlob, error } = await args.admin.storage
    .from(LESSON_READING_PDF_BUCKET)
    .download(args.contentUrl);

  if (error || !pdfBlob) {
    throw new Error(
      "The saved PDF reading could not be downloaded from secure storage.",
    );
  }

  const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
  return hashPdfBytes(bytes);
}

export async function getAccessibilityAudioStatus(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  currentSourceHash: string;
}): Promise<AccessibilityAudioStatus> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .select("*")
    .eq("lesson_material_id", args.lessonMaterialId)
    .maybeSingle();

  if (error) throw error;

  const row = data ? mapRow(data as RawRow) : null;
  const isStale = row !== null && row.sourceHash !== args.currentSourceHash;

  return { row, currentSourceHash: args.currentSourceHash, isStale };
}

// A freshly generated transcript always replaces any prior transcript AND
// invalidates any prior audio -- the old audio was speech of a different
// transcript and must never be served as if it matched this one.
export async function saveGeneratedTranscript(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  lessonId: string;
  subjectId: string;
  sourceType: "pasted_text" | "pdf";
  sourceHash: string;
  language: AccessibilityNarrationLanguage;
  voice: AccessibilityNarrationVoice;
  transcript: string;
}): Promise<AccessibilityAudioRow> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .upsert(
      {
        lesson_material_id: args.lessonMaterialId,
        lesson_id: args.lessonId,
        subject_id: args.subjectId,
        source_type: args.sourceType,
        source_hash: args.sourceHash,
        language: args.language,
        voice: args.voice,
        transcript: args.transcript,
        transcript_status: "generated",
        validation_notes: null,
        approved_at: null,
        approved_by: null,
        audio_status: "not_generated",
        audio_segments: [],
        audio_generated_at: null,
      },
      { onConflict: "lesson_material_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as RawRow);
}

// A hand-edit after approval quietly un-approves and invalidates any
// generated audio -- audio must always be speech of exactly the currently
// approved transcript, never a stale rendering of an earlier edit.
export async function saveEditedTranscript(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  transcript: string;
}): Promise<AccessibilityAudioRow> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({
      transcript: args.transcript,
      transcript_status: "generated",
      validation_notes: null,
      approved_at: null,
      approved_by: null,
      audio_status: "not_generated",
      audio_segments: [],
      audio_generated_at: null,
    })
    .eq("lesson_material_id", args.lessonMaterialId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as RawRow);
}

export async function recordApprovalValidationFailure(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  reason: string;
}): Promise<void> {
  const { error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({ validation_notes: args.reason })
    .eq("lesson_material_id", args.lessonMaterialId);

  if (error) throw error;
}

export async function approveTranscript(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  approvedByTeacherProfileId: string;
}): Promise<AccessibilityAudioRow> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({
      transcript_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: args.approvedByTeacherProfileId,
      validation_notes: null,
    })
    .eq("lesson_material_id", args.lessonMaterialId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as RawRow);
}

export async function markAudioGenerating(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
}): Promise<void> {
  const { error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({ audio_status: "generating" })
    .eq("lesson_material_id", args.lessonMaterialId);

  if (error) throw error;
}

export async function saveGeneratedAudio(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  segments: AccessibilityAudioSegment[];
}): Promise<AccessibilityAudioRow> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({
      audio_status: "ready",
      audio_segments: args.segments,
      audio_generated_at: new Date().toISOString(),
    })
    .eq("lesson_material_id", args.lessonMaterialId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as RawRow);
}

export async function markAudioFailed(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
}): Promise<void> {
  const { error } = await args.admin
    .from("lesson_accessibility_audio")
    .update({ audio_status: "failed", audio_segments: [] })
    .eq("lesson_material_id", args.lessonMaterialId);

  if (error) throw error;
}

export type LearnerAccessibilityAudio =
  | { ready: false }
  | { ready: true; segments: AccessibilityAudioSegment[] };

// THE single gate a learner-facing route may use to decide whether audio
// is safe to serve. Requires an approved transcript, ready audio, at least
// one segment, AND the stored source_hash to still equal the live current
// hash -- a stale row (reading edited since approval) resolves to
// { ready: false } exactly like a never-prepared one, never falling back
// to old audio.
export async function getLearnerAccessibilityAudio(args: {
  admin: SupabaseClient;
  lessonMaterialId: string;
  currentSourceHash: string;
}): Promise<LearnerAccessibilityAudio> {
  const { data, error } = await args.admin
    .from("lesson_accessibility_audio")
    .select("source_hash, transcript_status, audio_status, audio_segments")
    .eq("lesson_material_id", args.lessonMaterialId)
    .maybeSingle();

  if (error) throw error;

  const segments = normalizeSegments(data?.audio_segments);

  if (
    !data ||
    data.transcript_status !== "approved" ||
    data.audio_status !== "ready" ||
    data.source_hash !== args.currentSourceHash ||
    segments.length === 0
  ) {
    return { ready: false };
  }

  return { ready: true, segments };
}
