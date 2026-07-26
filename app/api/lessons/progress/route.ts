import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProgressEvent = "lesson_view" | "video_progress";

function isProgressEvent(value: unknown): value is ProgressEvent {
  return value === "lesson_view" || value === "video_progress";
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid lesson progress request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid lesson progress request." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const event = payload.event;
  const lessonId = payload.lessonId;

  if (!isProgressEvent(event) || typeof lessonId !== "string" || !uuidPattern.test(lessonId)) {
    return Response.json({ error: "Valid lesson progress details are required." }, { status: 400 });
  }

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
    const { data: lesson, error: lessonError } = await admin
      .from("lessons")
      .select("id, subject_id")
      .eq("id", lessonId)
      .eq("status", "published")
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (!lesson) {
      return Response.json({ error: "Published lesson not found." }, { status: 404 });
    }

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return Response.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await admin
      .from("learner_lesson_progress")
      .select("video_started_at, video_progress_percent, video_position_seconds")
      .eq("learner_profile_id", access.learnerProfileId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existingError) throw existingError;

    const progressUpdate: Record<string, unknown> = {
      learner_profile_id: access.learnerProfileId,
      lesson_id: lessonId,
      last_engaged_at: now,
      updated_at: now,
    };

    if (event === "video_progress") {
      const videoMaterialId = payload.videoMaterialId;
      const positionSeconds = payload.positionSeconds;
      const durationSeconds = payload.durationSeconds;

      if (
        typeof videoMaterialId !== "string" ||
        !uuidPattern.test(videoMaterialId) ||
        !isFiniteNonNegative(positionSeconds) ||
        !isFiniteNonNegative(durationSeconds) ||
        durationSeconds <= 0
      ) {
        return Response.json({ error: "Valid video progress details are required." }, { status: 400 });
      }

      const { data: videoMaterial, error: videoMaterialError } = await admin
        .from("lesson_materials")
        .select("id")
        .eq("id", videoMaterialId)
        .eq("lesson_id", lessonId)
        .eq("material_type", "video")
        .maybeSingle();

      if (videoMaterialError) throw videoMaterialError;
      if (!videoMaterial) {
        return Response.json({ error: "The lesson video was not found." }, { status: 404 });
      }

      const boundedPosition = Math.min(positionSeconds, durationSeconds);
      const percentage = Math.min(100, (boundedPosition / durationSeconds) * 100);
      const previousPercentage = Number(existing?.video_progress_percent ?? 0);
      const previousPosition = Number(existing?.video_position_seconds ?? 0);

      Object.assign(progressUpdate, {
        video_material_id: videoMaterial.id,
        video_started_at: existing?.video_started_at ?? now,
        video_progress_percent: Math.max(previousPercentage, percentage),
        video_position_seconds: Math.max(previousPosition, boundedPosition),
        video_duration_seconds: durationSeconds,
        video_updated_at: now,
      });
    }

    const { error: saveError } = await admin
      .from("learner_lesson_progress")
      .upsert(progressUpdate, { onConflict: "learner_profile_id,lesson_id" });

    if (saveError) throw saveError;

    return Response.json({ saved: true });
  } catch (error) {
    console.error("Lesson progress save failed:", {
      lessonId,
      event,
      error: error instanceof Error ? error.message : error,
    });
    return Response.json(
      { error: "Lesson progress could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
