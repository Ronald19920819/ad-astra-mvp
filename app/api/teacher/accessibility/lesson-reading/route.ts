import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  generateAndStoreAccessibilityAudio,
  deleteAccessibilityAudioSegments,
} from "@/lib/kingdom/accessibilityAudioGeneration";
import { generateAccessibilityNarrationTranscript } from "@/lib/kingdom/accessibilityNarrationGeneration";
import { validateAccessibilityNarration } from "@/lib/accessibility/narrationIntegrity";
import { getAccessibilityNarrationVoice } from "@/lib/accessibility/narrationVoice";
import {
  approveTranscript,
  computeCurrentReadingSourceHash,
  getAccessibilityAudioStatus,
  markAudioFailed,
  markAudioGenerating,
  recordApprovalValidationFailure,
  saveEditedTranscript,
  saveGeneratedAudio,
  saveGeneratedTranscript,
  type AccessibilityAudioStatus,
} from "@/lib/supabase/lessonAccessibilityAudio";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(error: string) {
  return Response.json({ error, code: "INVALID_REQUEST" }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Teacher-level authorization (authorizeTeacher(subjectId)) is used for
// every accessibility-preparation action in this route -- generating,
// editing, approving a transcript, and generating audio. This is a
// deliberate choice, not an oversight: subject teachers in this app already
// have full authority over everything else about a lesson's reading
// (writing it, uploading/replacing its PDF, publishing the lesson), so
// gating narration preparation one level higher (administrator-only) would
// be an inconsistent, unexplained exception for a subject-scoped,
// low-cost (~$0.03-0.05/lesson) content-quality action. Administrator-only
// gating remains reserved for the genuinely cross-subject/global concerns
// this app already treats that way -- learner accessibility ENTITLEMENT
// itself (Stage A) and Coin ledger admin adjustments.
async function loadReadingMaterial(
  admin: SupabaseClient,
  subjectId: string,
  lessonId: string,
) {
  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, subject_id, status")
    .eq("id", lessonId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (!lesson) return { lesson: null, material: null };

  const { data: material, error: materialError } = await admin
    .from("lesson_materials")
    .select("id, source_type, content_text, content_url")
    .eq("lesson_id", lessonId)
    .eq("material_type", "reading")
    .maybeSingle();

  if (materialError) throw materialError;
  return { lesson, material };
}

// Every caller of this (the GET status lookup and all four POST actions)
// is only ever reached once a reading material has already been confirmed
// to exist -- so hasReading is unconditionally true here. Previously only
// the GET handler set this field explicitly (line ~137 below), so every
// POST action response omitted it entirely; AccessibilityAudioCard's
// `if (!data?.hasReading) return null` then unmounted the whole card
// immediately after any successful action (generate/save/approve/generate
// audio), even though the change had persisted correctly.
function serializeStatus(status: AccessibilityAudioStatus) {
  const row = status.row;
  return {
    hasReading: true as const,
    isStale: status.isStale,
    transcriptStatus: row?.transcriptStatus ?? "not_prepared",
    audioStatus: row?.audioStatus ?? "not_generated",
    language: row?.language ?? null,
    voice: row?.voice ?? null,
    transcript: row?.transcript ?? null,
    validationNotes: row?.validationNotes ?? null,
    approvedAt: row?.approvedAt ?? null,
    audioGeneratedAt: row?.audioGeneratedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
    segmentCount: row?.audioSegments.length ?? 0,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const subjectId = url.searchParams.get("subjectId");
    const lessonId = url.searchParams.get("lessonId");

    if (
      !subjectId ||
      !uuidPattern.test(subjectId) ||
      !lessonId ||
      !uuidPattern.test(lessonId) ||
      !getSubjectConfigurationByDatabaseId(subjectId)
    ) {
      return invalid("A valid subject and lesson are required.");
    }

    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const { admin } = authorization.teacher;

    const { lesson, material } = await loadReadingMaterial(admin, subjectId, lessonId);
    if (!lesson) {
      return Response.json({ error: "Lesson not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (!material) {
      return Response.json({ hasReading: false });
    }

    const currentSourceHash = await computeCurrentReadingSourceHash({
      admin,
      sourceType: material.source_type === "pdf" ? "pdf" : "pasted_text",
      contentText: material.content_text,
      contentUrl: material.content_url,
      subjectId,
      lessonId,
    });
    const status = await getAccessibilityAudioStatus({
      admin,
      lessonMaterialId: material.id,
      currentSourceHash,
    });

    return Response.json(serializeStatus(status));
  } catch (error) {
    console.error("Accessibility reading status lookup failed:", error);
    return Response.json(
      { error: "The accessibility audio status could not be loaded.", code: "LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalid("Malformed JSON request body.");
    }

    if (!isRecord(body) || typeof body.action !== "string") {
      return invalid("A valid accessibility action is required.");
    }

    const subjectId = body.subjectId;
    const lessonId = body.lessonId;
    const subject = typeof subjectId === "string" ? getSubjectConfigurationByDatabaseId(subjectId) : null;

    if (
      typeof subjectId !== "string" ||
      !uuidPattern.test(subjectId) ||
      typeof lessonId !== "string" ||
      !uuidPattern.test(lessonId) ||
      !subject
    ) {
      return invalid("A valid subject and lesson are required.");
    }

    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const { admin, teacherProfileId } = authorization.teacher;

    const { lesson, material } = await loadReadingMaterial(admin, subjectId, lessonId);
    if (!lesson) {
      return Response.json({ error: "Lesson not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (!material) {
      return Response.json(
        { error: "This lesson has no reading yet.", code: "NO_READING" },
        { status: 404 },
      );
    }

    const sourceType: "pasted_text" | "pdf" = material.source_type === "pdf" ? "pdf" : "pasted_text";
    const currentSourceHash = await computeCurrentReadingSourceHash({
      admin,
      sourceType,
      contentText: material.content_text,
      contentUrl: material.content_url,
      subjectId,
      lessonId,
    });

    if (body.action === "generate-transcript") {
      const generated = await generateAccessibilityNarrationTranscript({
        admin,
        subjectKey: subject.key,
        lessonId,
      });

      const validation = validateAccessibilityNarration({
        sourceType: generated.sourceType,
        sourceContentText: generated.sourceContentText,
        transcript: generated.transcript,
      });

      if (!validation.ok) {
        return Response.json(
          { error: validation.reason, code: "NARRATION_VALIDATION_FAILED" },
          { status: 422 },
        );
      }

      const priorStatus = await getAccessibilityAudioStatus({
        admin,
        lessonMaterialId: material.id,
        currentSourceHash,
      });
      const { voice, language } = getAccessibilityNarrationVoice(subject.familyKey);

      const row = await saveGeneratedTranscript({
        admin,
        lessonMaterialId: material.id,
        lessonId,
        subjectId,
        sourceType,
        sourceHash: currentSourceHash,
        language,
        voice,
        transcript: generated.transcript,
      });

      if (priorStatus.row && priorStatus.row.audioSegments.length > 0) {
        await deleteAccessibilityAudioSegments(admin, priorStatus.row.audioSegments);
      }

      return Response.json({
        success: true,
        ...serializeStatus({ row, currentSourceHash, isStale: false }),
      });
    }

    if (body.action === "save-transcript") {
      const transcript = body.transcript;
      if (typeof transcript !== "string" || !transcript.trim()) {
        return invalid("A non-empty transcript is required.");
      }

      const priorStatus = await getAccessibilityAudioStatus({
        admin,
        lessonMaterialId: material.id,
        currentSourceHash,
      });
      if (!priorStatus.row) {
        return Response.json(
          { error: "Generate an accessibility transcript before editing it.", code: "NOT_PREPARED" },
          { status: 409 },
        );
      }

      const row = await saveEditedTranscript({
        admin,
        lessonMaterialId: material.id,
        transcript: transcript.trim(),
      });

      if (priorStatus.row.audioSegments.length > 0) {
        await deleteAccessibilityAudioSegments(admin, priorStatus.row.audioSegments);
      }

      return Response.json({
        success: true,
        ...serializeStatus({ row, currentSourceHash, isStale: false }),
      });
    }

    if (body.action === "approve-transcript") {
      const status = await getAccessibilityAudioStatus({
        admin,
        lessonMaterialId: material.id,
        currentSourceHash,
      });

      if (!status.row || status.row.transcriptStatus === "not_prepared") {
        return Response.json(
          { error: "Generate an accessibility transcript before approving it.", code: "NOT_PREPARED" },
          { status: 409 },
        );
      }
      if (status.isStale) {
        return Response.json(
          {
            error: "The reading has changed since this transcript was generated. Regenerate the transcript before approving.",
            code: "STALE",
          },
          { status: 409 },
        );
      }

      const validation = validateAccessibilityNarration({
        sourceType: status.row.sourceType,
        sourceContentText:
          sourceType === "pasted_text" ? material.content_text : null,
        transcript: status.row.transcript ?? "",
      });

      if (!validation.ok) {
        await recordApprovalValidationFailure({
          admin,
          lessonMaterialId: material.id,
          reason: validation.reason,
        });
        return Response.json(
          { error: validation.reason, code: "NARRATION_VALIDATION_FAILED" },
          { status: 422 },
        );
      }

      const row = await approveTranscript({
        admin,
        lessonMaterialId: material.id,
        approvedByTeacherProfileId: teacherProfileId,
      });

      return Response.json({
        success: true,
        ...serializeStatus({ row, currentSourceHash, isStale: false }),
      });
    }

    if (body.action === "generate-audio") {
      const status = await getAccessibilityAudioStatus({
        admin,
        lessonMaterialId: material.id,
        currentSourceHash,
      });

      if (!status.row || status.row.transcriptStatus !== "approved") {
        return Response.json(
          { error: "Approve the accessibility transcript before generating audio.", code: "NOT_APPROVED" },
          { status: 409 },
        );
      }
      if (status.isStale) {
        return Response.json(
          {
            error: "The reading has changed since this transcript was approved. Regenerate and re-approve before generating audio.",
            code: "STALE",
          },
          { status: 409 },
        );
      }

      await markAudioGenerating({ admin, lessonMaterialId: material.id });

      try {
        const segments = await generateAndStoreAccessibilityAudio({
          admin,
          subjectId,
          lessonId,
          materialId: material.id,
          sourceHash: currentSourceHash,
          voice: status.row.voice,
          transcript: status.row.transcript ?? "",
        });

        const row = await saveGeneratedAudio({
          admin,
          lessonMaterialId: material.id,
          segments,
        });

        return Response.json({
          success: true,
          ...serializeStatus({ row, currentSourceHash, isStale: false }),
        });
      } catch (audioError) {
        console.error("Accessibility audio generation failed:", audioError);
        await markAudioFailed({ admin, lessonMaterialId: material.id });
        return Response.json(
          { error: "Audio generation failed. Please try again.", code: "AUDIO_GENERATION_FAILED" },
          { status: 502 },
        );
      }
    }

    return invalid("Unsupported accessibility action.");
  } catch (error) {
    console.error("Accessibility reading preparation failed:", error);
    return Response.json(
      { error: "This accessibility action could not be completed.", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}
