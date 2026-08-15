import {
  LESSON_READING_PDF_BUCKET,
  LESSON_READING_PDF_SIGNED_URL_SECONDS,
} from "@/lib/lessons/pdfReading";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { LESSON_READING_PDF_BUCKET, LESSON_READING_PDF_SIGNED_URL_SECONDS };

export function buildActivitySubmissionPdfSnapshotPath(
  learnerId: string,
  activityId: string,
) {
  return `activity-submissions/${learnerId}/${activityId}/${crypto.randomUUID()}.pdf`;
}

export function isActivitySubmissionPdfSnapshotPath(
  path: string,
  learnerId: string,
  activityId: string,
) {
  if (!uuidPattern.test(learnerId) || !uuidPattern.test(activityId)) return false;

  const prefix = `activity-submissions/${learnerId}/${activityId}/`;
  const fileName = path.slice(prefix.length);

  return (
    path.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.pdf$/i.test(fileName) &&
    !fileName.includes("/")
  );
}
