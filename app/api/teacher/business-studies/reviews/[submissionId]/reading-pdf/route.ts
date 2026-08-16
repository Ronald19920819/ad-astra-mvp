import {
  isActivitySubmissionPdfSnapshotPath,
  LESSON_READING_PDF_BUCKET,
  LESSON_READING_PDF_SIGNED_URL_SECONDS,
} from "@/lib/activities/activitySnapshotPdf";
import { isActivitySubmissionSnapshot } from "@/lib/activities/activitySnapshot";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;

  if (!uuidPattern.test(submissionId)) {
    return Response.json(
      { error: "A valid submission ID is required." },
      { status: 400 },
    );
  }

  const subjectId = new URL(request.url).searchParams.get("subjectId");

  if (!subjectId || !getSubjectConfigurationByDatabaseId(subjectId)) {
    return Response.json(
      { error: "A valid subject is required." },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const admin = authorization.teacher.admin;
    const { data: submission, error } = await admin
      .from("activity_submissions")
      .select("id, learner_id, activity_snapshot")
      .eq("id", submissionId)
      .maybeSingle();

    if (error) throw error;
    if (!submission) {
      return Response.json({ error: "PDF reading not found." }, { status: 404 });
    }

    const snapshot = isActivitySubmissionSnapshot(submission.activity_snapshot)
      ? submission.activity_snapshot
      : null;

    if (
      !snapshot ||
      snapshot.subject.id !== subjectId ||
      snapshot.reading.sourceType !== "pdf" ||
      typeof snapshot.reading.pdfStoragePath !== "string" ||
      !isActivitySubmissionPdfSnapshotPath(
        snapshot.reading.pdfStoragePath,
        submission.learner_id,
        snapshot.activity.id,
      )
    ) {
      return Response.json({ error: "PDF reading not found." }, { status: 404 });
    }

    const { data, error: signedUrlError } = await admin.storage
      .from(LESSON_READING_PDF_BUCKET)
      .createSignedUrl(
        snapshot.reading.pdfStoragePath,
        LESSON_READING_PDF_SIGNED_URL_SECONDS,
      );

    if (signedUrlError || !data?.signedUrl) {
      throw signedUrlError ?? new Error("Signed PDF access could not be created.");
    }

    return Response.redirect(data.signedUrl, 307);
  } catch (error) {
    console.error("Teacher activity snapshot PDF access failed:", {
      submissionId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "The PDF reading could not be opened." },
      { status: 500 },
    );
  }
}