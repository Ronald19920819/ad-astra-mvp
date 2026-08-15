import {
  isLessonReadingPdfPath,
  LESSON_READING_PDF_BUCKET,
  LESSON_READING_PDF_SIGNED_URL_SECONDS,
} from "@/lib/lessons/pdfReading";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: RouteContext<"/api/lessons/[lessonId]/reading-pdf">,
) {
  const { lessonId } = await context.params;
  const materialId = new URL(request.url).searchParams.get("materialId");

  if (!uuidPattern.test(lessonId) || !materialId || !uuidPattern.test(materialId)) {
    return Response.json({ error: "Valid PDF reading details are required." }, { status: 400 });
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
    const { data: material, error } = await admin
      .from("lesson_materials")
      .select("id, source_type, content_url, lessons!inner(id, subject_id, status)")
      .eq("id", materialId)
      .eq("lesson_id", lessonId)
      .eq("material_type", "reading")
      .maybeSingle();

    if (error) throw error;
    if (!material) {
      return Response.json({ error: "PDF reading not found." }, { status: 404 });
    }

    const lesson = Array.isArray(material.lessons)
      ? material.lessons[0]
      : material.lessons;
    if (!lesson || lesson.status !== "published") {
      return Response.json({ error: "PDF reading is not available." }, { status: 404 });
    }

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return Response.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    if (
      material.source_type !== "pdf" ||
      typeof material.content_url !== "string" ||
      !isLessonReadingPdfPath(material.content_url, lesson.subject_id, lessonId)
    ) {
      return Response.json({ error: "PDF reading not found." }, { status: 404 });
    }

    const { data, error: signedUrlError } = await admin.storage
      .from(LESSON_READING_PDF_BUCKET)
      .createSignedUrl(
        material.content_url,
        LESSON_READING_PDF_SIGNED_URL_SECONDS,
      );

    if (signedUrlError || !data?.signedUrl) {
      throw signedUrlError ?? new Error("Signed PDF access could not be created.");
    }

    return Response.redirect(data.signedUrl, 307);
  } catch (error) {
    console.error("Learner PDF reading access failed:", {
      lessonId,
      materialId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "The PDF reading could not be opened." },
      { status: 500 },
    );
  }
}
