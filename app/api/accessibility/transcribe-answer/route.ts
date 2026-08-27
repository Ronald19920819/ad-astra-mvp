import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";
import { getLearnerAccessibilityEntitlement } from "@/lib/supabase/learnerAccessibility";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  getAccessibilityNarrationVoice,
  toTranscriptionLanguageCode,
} from "@/lib/accessibility/narrationVoice";
import { mimeTypeToFileExtension } from "@/lib/accessibility/audioMimeType";
import { ANSWER_TRANSCRIPTION_MODEL, transcribeAnswerAudio } from "@/lib/kingdom/answerTranscription";
import { MAX_RECORDING_SECONDS } from "@/lib/accessibility/recordingLimits";
import { checkTranscriptPlausibility } from "@/lib/accessibility/transcriptPlausibility";

// TEMPORARY DEV-ONLY DIAGNOSTIC -- added to trace a real
// TRANSCRIPTION_IMPLAUSIBLY_SHORT rejection with measured server-side
// evidence (uploaded file size/type -> model/language used -> complete
// returned transcript -> plausibility verdict). Never runs outside
// development, never included in any response sent to the learner, never
// logs the audio itself. Safe/expected to be deleted once the
// diagnostic is complete.
const STAGE_D_DIAGNOSTIC_ENABLED = process.env.NODE_ENV === "development";
function logStageDDiagnostic(label: string, data: Record<string, unknown>) {
  if (!STAGE_D_DIAGNOSTIC_ENABLED) return;
  console.log(`[StageD-DIAG][server] ${label}`, data);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UNAVAILABLE_MESSAGE =
  "Your recording could not be transcribed. Please try again.";
const EMPTY_SPEECH_MESSAGE = "No speech was detected. Please try again.";
const IMPLAUSIBLE_TRANSCRIPT_MESSAGE =
  "Your recording could not be fully transcribed. Please try again.";

// Stage D ("Record Answer"): no framework-level request-body size limit
// exists for Route Handlers in this app (checked next.config.js and
// every existing route) -- this is the application-level guard.
// Generous enough for a several-minute spoken activity answer at any of
// the codec candidates in lib/accessibility/audioMimeType.ts, small
// enough to reject anything resembling abuse.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// Stage D: turns a learner's own spoken activity answer into text,
// inserted into the SAME textarea a keyboard answer would use --
// transcription only, never rewritten/improved/evaluated. Every gate is
// re-checked fresh on every request, mirroring the established
// accessibility-audio route pattern:
//   1. genuine authenticated learner session;
//   2. accessibility_enabled entitlement (the Stage A canonical reader);
//   3. the activity has NOT already been submitted -- recording is never
//      allowed once an activity is locked, with no snapshot fallback
//      (unlike the playback-only question-audio route, which does allow
//      listening after submission);
//   4. enrolled subject access for the activity's lesson
//      (verifyLearnerSubjectAccess);
//   5. the requested question genuinely belongs to this activity;
//   6. the uploaded audio is a real, size- and type-bounded audio file.
// Raw audio is processed in memory only (Buffer -> OpenAI -> discarded)
// -- never written to disk, never uploaded to Storage, never persisted
// anywhere.
export async function POST(request: Request) {
  try {
    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Learner sign-in is required." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const entitlement = await getLearnerAccessibilityEntitlement({
      authUserId: user.id,
    });
    if (!entitlement.accessibilityEnabled) {
      return Response.json(
        { error: "Accessibility support is not enabled for this learner." },
        { status: 403 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json(
        { error: "A valid recording upload is required." },
        { status: 400 },
      );
    }

    const activityId = formData.get("activityId");
    const questionId = formData.get("questionId");
    const audio = formData.get("audio");
    const recordingDurationSecondsRaw = formData.get("recordingDurationSeconds");
    const recordingDurationSeconds =
      typeof recordingDurationSecondsRaw === "string"
        ? Number(recordingDurationSecondsRaw)
        : NaN;

    if (
      typeof activityId !== "string" ||
      !uuidPattern.test(activityId) ||
      typeof questionId !== "string" ||
      !uuidPattern.test(questionId) ||
      !(audio instanceof File) ||
      // The client is the only party that genuinely knows how long the
      // learner spoke; this is validated for plausibility (used only by
      // checkTranscriptPlausibility below) -- never trusted for any
      // security-critical decision.
      !Number.isFinite(recordingDurationSeconds) ||
      recordingDurationSeconds <= 0 ||
      recordingDurationSeconds > MAX_RECORDING_SECONDS
    ) {
      return Response.json(
        { error: "A valid recording upload is required." },
        { status: 400 },
      );
    }

    if (!audio.type.startsWith("audio/")) {
      return Response.json(
        { error: "Unsupported recording format. Please try again." },
        { status: 415 },
      );
    }

    if (audio.size === 0) {
      return Response.json({ error: EMPTY_SPEECH_MESSAGE }, { status: 422 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: "Your recording is too long. Please record a shorter answer." },
        { status: 413 },
      );
    }

    logStageDDiagnostic("request received", {
      recordingDurationSeconds,
      audioSizeBytes: audio.size,
      audioMimeType: audio.type,
      audioFileName: audio.name,
    });

    const { data: activity, error: activityError } = await admin
      .from("activities")
      .select("id, lesson_material_id")
      .eq("id", activityId)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return Response.json({ error: "This activity could not be found." }, { status: 404 });
    }

    // Recording is never allowed once the activity has been submitted --
    // unlike Stage C's question-audio route, there is no
    // frozen-snapshot fallback here at all.
    const { data: existingSubmission, error: submissionError } = await admin
      .from("activity_submissions")
      .select("id")
      .eq("activity_id", activityId)
      .eq("learner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (submissionError) throw submissionError;
    if (existingSubmission) {
      return Response.json(
        { error: "This activity has already been submitted." },
        { status: 409 },
      );
    }

    const { data: material, error: materialError } = await admin
      .from("lesson_materials")
      .select("id, lessons!inner(id, subject_id, status)")
      .eq("id", activity.lesson_material_id)
      .maybeSingle();

    if (materialError) throw materialError;

    const lesson = material
      ? Array.isArray(material.lessons)
        ? material.lessons[0]
        : material.lessons
      : null;

    if (!lesson || lesson.status !== "published") {
      return Response.json({ error: "This activity could not be found." }, { status: 404 });
    }

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return Response.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    // Scoped by BOTH id and activity_id -- an arbitrary questionId from a
    // different activity can never be transcribed against this one.
    const { data: question, error: questionError } = await admin
      .from("activity_questions")
      .select("id")
      .eq("id", questionId)
      .eq("activity_id", activityId)
      .maybeSingle();

    if (questionError) throw questionError;
    if (!question) {
      return Response.json({ error: "This question could not be found." }, { status: 404 });
    }

    const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
    if (!subject) {
      return Response.json({ error: "This subject could not be resolved." }, { status: 500 });
    }

    const { language } = getAccessibilityNarrationVoice(subject.familyKey);
    const languageCode = toTranscriptionLanguageCode(language);

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const fileName = `recording.${mimeTypeToFileExtension(audio.type)}`;

    logStageDDiagnostic("calling transcription API", {
      model: ANSWER_TRANSCRIPTION_MODEL,
      languageCode,
      fileName,
      mimeType: audio.type,
      audioBufferSizeBytes: audioBuffer.byteLength,
    });

    const text = await transcribeAnswerAudio({
      audioBuffer,
      fileName,
      mimeType: audio.type,
      languageCode,
    });

    const transcriptWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    logStageDDiagnostic("transcription returned", {
      transcriptCharacterCount: text.length,
      transcriptWordCount,
      completeTranscript: text,
    });

    if (!text.trim()) {
      return Response.json({ error: EMPTY_SPEECH_MESSAGE }, { status: 422 });
    }

    // Conservative, non-semantic safeguard: catches a provider silently
    // returning a drastically-too-short transcript for a long recording
    // (the real incident this was added for: a genuine ~40-second
    // recording came back as just "This is a test"). Never grades or
    // evaluates content -- see
    // lib/accessibility/transcriptPlausibility.ts's own doc comment. A
    // rejected transcript is never returned to the client, so it can
    // never be inserted into the textarea or trigger autosave.
    const plausibility = checkTranscriptPlausibility({
      recordingDurationSeconds,
      transcriptText: text,
    });
    logStageDDiagnostic("plausibility verdict", {
      plausible: plausibility.plausible,
      reason: plausibility.plausible ? null : plausibility.reason,
    });
    if (!plausibility.plausible) {
      return Response.json(
        { error: IMPLAUSIBLE_TRANSCRIPT_MESSAGE, code: plausibility.reason },
        { status: 422 },
      );
    }

    return Response.json({ text });
  } catch (error) {
    console.error("Learner answer transcription failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
