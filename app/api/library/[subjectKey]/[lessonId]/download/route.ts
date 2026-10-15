import {
  LESSON_READING_PDF_BUCKET,
  LESSON_READING_PDF_SIGNED_URL_SECONDS,
  buildLibraryReadingDownloadFilename,
} from "@/lib/lessons/pdfReading";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveAuthorizedLibraryReading } from "@/lib/supabase/libraryPdfAccess";

// AD ASTRA -- LIBRARY CLUB (STAGE C): the one Library Club download
// route. Every request independently re-resolves and re-authorizes the
// exact (subjectKey, lessonId) pair via the shared
// resolveAuthorizedLibraryReading helper -- never trusting a materialId,
// storage path, or anything else the client might supply, and never
// reusing a cached catalogue result. Only on a fully-authorized "ok"
// result is a short-lived signed URL generated, with Supabase Storage's
// own `download` disposition option so the browser downloads the
// original PDF bytes under a human-readable filename -- the file itself
// is never streamed through this server, and the private bucket's
// privacy/policies are completely untouched.
export async function GET(
  request: Request,
  context: { params: Promise<{ subjectKey: string; lessonId: string }> },
) {
  const { subjectKey, lessonId } = await context.params;

  try {
    const result = await resolveAuthorizedLibraryReading(subjectKey, lessonId);

    if (result.status === "unauthenticated") {
      return Response.json(
        { error: "Learner sign-in is required." },
        { status: 401 },
      );
    }

    if (result.status === "not_found") {
      return Response.json(
        { error: "This Library Club reading is not available." },
        { status: 404 },
      );
    }

    const { reading } = result;
    const admin = createSupabaseAdminClient();
    const filename = buildLibraryReadingDownloadFilename(
      reading.subject.displayName,
      reading.lessonNumber,
      reading.lessonTitle,
    );

    const { data, error: signedUrlError } = await admin.storage
      .from(LESSON_READING_PDF_BUCKET)
      .createSignedUrl(reading.contentPath, LESSON_READING_PDF_SIGNED_URL_SECONDS, {
        download: filename,
      });

    if (signedUrlError || !data?.signedUrl) {
      throw signedUrlError ?? new Error("A signed download URL could not be created.");
    }

    return Response.redirect(data.signedUrl, 307);
  } catch (error) {
    console.error("Library Club PDF download failed:", {
      subjectKey,
      lessonId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "This Library Club reading could not be downloaded." },
      { status: 500 },
    );
  }
}
