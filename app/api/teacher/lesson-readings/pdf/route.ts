import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLessonReadingPdfPath,
  hasPdfSignature,
  isLessonReadingPdfPath,
  isPdfFileMetadata,
  LESSON_READING_PDF_BUCKET,
} from "@/lib/lessons/pdfReading";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestBody = Record<string, unknown>;

function invalid(error: string) {
  return Response.json({ error }, { status: 400 });
}

async function getAuthorizedLesson(body: RequestBody) {
  const subjectId = body.subjectId;
  const lessonId = body.lessonId;

  if (
    typeof subjectId !== "string" ||
    !uuidPattern.test(subjectId) ||
    typeof lessonId !== "string" ||
    !uuidPattern.test(lessonId)
  ) {
    return { response: invalid("Valid subject and lesson details are required.") };
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return { response: teacherAuthorizationResponse(authorization) };
  }

  const { data: lesson, error } = await authorization.teacher.admin
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) throw error;
  if (!lesson) {
    return {
      response: Response.json(
        { error: "The lesson was not found for this subject." },
        { status: 404 },
      ),
    };
  }

  return {
    authorization,
    subjectId,
    lessonId,
  };
}

async function verifyStoredPdf(
  admin: SupabaseClient,
  path: string,
) {
  const { data, error } = await admin.storage
    .from(LESSON_READING_PDF_BUCKET)
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) return false;

  const response = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-4" },
    cache: "no-store",
  });
  if (!response.ok) return false;

  const bytes = new Uint8Array(await response.arrayBuffer());
  return hasPdfSignature(bytes);
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return invalid("Invalid PDF reading request.");
  }

  try {
    const lessonAccess = await getAuthorizedLesson(body);
    if ("response" in lessonAccess) return lessonAccess.response;

    const { authorization, subjectId, lessonId } = lessonAccess;
    const { admin } = authorization.teacher;

    if (body.action === "prepare") {
      if (
        !isPdfFileMetadata({
          fileName: body.fileName,
          contentType: body.contentType,
          size: body.size,
        })
      ) {
        return invalid("Select a valid PDF no larger than 25 MB.");
      }

      const path = buildLessonReadingPdfPath(subjectId, lessonId);
      const { data, error } = await admin.storage
        .from(LESSON_READING_PDF_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data?.token) {
        throw error ?? new Error("A secure PDF upload could not be prepared.");
      }

      return Response.json({ path, token: data.token });
    }

    if (body.action === "finalize") {
      const title = body.title;
      const path = body.path;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 300 ||
        typeof path !== "string" ||
        !isLessonReadingPdfPath(path, subjectId, lessonId)
      ) {
        return invalid("Valid PDF reading details are required.");
      }

      if (!(await verifyStoredPdf(admin, path))) {
        await admin.storage.from(LESSON_READING_PDF_BUCKET).remove([path]);
        return invalid("The uploaded file is not a valid PDF.");
      }

      const { data: existing, error: existingError } = await admin
        .from("lesson_materials")
        .select("id, source_type, content_url")
        .eq("lesson_id", lessonId)
        .eq("material_type", "reading")
        .maybeSingle();
      if (existingError) throw existingError;

      const values = {
        source_type: "pdf",
        title: title.trim(),
        required: true,
        content_url: path,
        content_text: null,
        display_order: 1,
      };
      const result = existing
        ? await admin
            .from("lesson_materials")
            .update(values)
            .eq("id", existing.id)
            .select("id, source_type, content_url")
            .single()
        : await admin
            .from("lesson_materials")
            .insert({ lesson_id: lessonId, material_type: "reading", ...values })
            .select("id, source_type, content_url")
            .single();

      if (result.error) {
        await admin.storage.from(LESSON_READING_PDF_BUCKET).remove([path]);
        throw result.error;
      }

      const previousPath = existing?.content_url;
      if (
        existing?.source_type === "pdf" &&
        typeof previousPath === "string" &&
        previousPath !== path &&
        isLessonReadingPdfPath(previousPath, subjectId, lessonId)
      ) {
        const { error: cleanupError } = await admin.storage
          .from(LESSON_READING_PDF_BUCKET)
          .remove([previousPath]);
        if (cleanupError) {
          console.warn("Previous lesson PDF cleanup failed:", {
            lessonId,
            message: cleanupError.message,
          });
        }
      }

      return Response.json({ success: true, data: result.data });
    }

    return invalid("Unsupported PDF reading action.");
  } catch (error) {
    console.error("Lesson PDF reading save failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "The PDF reading could not be saved." },
      { status: 500 },
    );
  }
}

