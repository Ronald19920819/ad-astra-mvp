import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";
import { getLearnerAccessibilityEntitlement } from "@/lib/supabase/learnerAccessibility";
import {
  computeCurrentReadingSourceHash,
  getLearnerAccessibilityAudio,
} from "@/lib/supabase/lessonAccessibilityAudio";
import {
  LESSON_AUDIO_BUCKET,
  LESSON_AUDIO_SIGNED_URL_SECONDS,
} from "@/lib/kingdom/accessibilityAudioGeneration";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function notReady() {
  return Response.json({ ready: false });
}

// Serves accessibility audio to an entitled learner only. Every gate is
// re-checked here, freshly, on every request -- never cached, never
// inferred from a prior response:
//   1. genuine authenticated learner session;
//   2. enrolled subject access for this lesson (verifyLearnerSubjectAccess);
//   3. accessibility_enabled entitlement (the Stage A canonical reader);
//   4. an approved transcript with ready audio whose stored source_hash
//      still equals the reading's LIVE current hash -- a stale row (the
//      reading was edited since approval) resolves to not-ready exactly
//      like audio that was never prepared (getLearnerAccessibilityAudio).
export async function GET(
  request: Request,
  context: RouteContext<"/api/lessons/[lessonId]/accessibility-audio">,
) {
  const { lessonId } = await context.params;
  const materialId = new URL(request.url).searchParams.get("materialId");

  if (!uuidPattern.test(lessonId) || !materialId || !uuidPattern.test(materialId)) {
    return Response.json(
      { error: "Valid accessibility audio details are required." },
      { status: 400 },
    );
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

    const { data: material, error: materialError } = await admin
      .from("lesson_materials")
      .select(
        "id, source_type, content_text, content_url, lessons!inner(id, subject_id, status)",
      )
      .eq("id", materialId)
      .eq("lesson_id", lessonId)
      .eq("material_type", "reading")
      .maybeSingle();

    if (materialError) throw materialError;
    if (!material) return notReady();

    const lesson = Array.isArray(material.lessons)
      ? material.lessons[0]
      : material.lessons;
    if (!lesson || lesson.status !== "published") return notReady();

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return Response.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    const entitlement = await getLearnerAccessibilityEntitlement({
      authUserId: user.id,
    });
    if (!entitlement.accessibilityEnabled) {
      return Response.json(
        { error: "Accessibility support is not enabled for this learner." },
        { status: 403 },
      );
    }

    const currentSourceHash = await computeCurrentReadingSourceHash({
      admin,
      sourceType: material.source_type === "pdf" ? "pdf" : "pasted_text",
      contentText: material.content_text,
      contentUrl: material.content_url,
      subjectId: lesson.subject_id,
      lessonId,
    });

    const audio = await getLearnerAccessibilityAudio({
      admin,
      lessonMaterialId: material.id,
      currentSourceHash,
    });

    if (!audio.ready) return notReady();

    const orderedSegments = [...audio.segments].sort((a, b) => a.index - b.index);
    const signedSegments = await Promise.all(
      orderedSegments.map(async (segment) => {
        const { data, error: signedUrlError } = await admin.storage
          .from(LESSON_AUDIO_BUCKET)
          .createSignedUrl(segment.storagePath, LESSON_AUDIO_SIGNED_URL_SECONDS);

        if (signedUrlError || !data?.signedUrl) {
          throw signedUrlError ?? new Error("Signed accessibility audio access could not be created.");
        }

        return { index: segment.index, url: data.signedUrl };
      }),
    );

    // sourceVersion lets the client safely persist/restore a playback
    // position across visits: a saved position is only ever applied when
    // this value still matches (see lib/accessibility/playbackPosition.ts)
    // -- if the teacher regenerates/re-approves audio, currentSourceHash
    // changes and any old saved position is ignored, never applied to a
    // different recording. Never a new column/migration -- this is the
    // same source_hash already computed above for staleness checking.
    return Response.json({
      ready: true,
      segments: signedSegments,
      sourceVersion: currentSourceHash,
    });
  } catch (error) {
    console.error("Learner accessibility audio access failed:", {
      lessonId,
      materialId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "The accessibility audio could not be opened." },
      { status: 500 },
    );
  }
}
