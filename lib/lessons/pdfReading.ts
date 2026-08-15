export const LESSON_READING_PDF_BUCKET = "lesson-readings";
export const LESSON_READING_PDF_MAX_BYTES = 25 * 1024 * 1024;
export const LESSON_READING_PDF_SIGNED_URL_SECONDS = 5 * 60;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPdfFileMetadata(input: {
  fileName: unknown;
  contentType: unknown;
  size: unknown;
}) {
  return (
    typeof input.fileName === "string" &&
    input.fileName.toLowerCase().endsWith(".pdf") &&
    input.contentType === "application/pdf" &&
    typeof input.size === "number" &&
    Number.isInteger(input.size) &&
    input.size > 0 &&
    input.size <= LESSON_READING_PDF_MAX_BYTES
  );
}

export function buildLessonReadingPdfPath(
  subjectId: string,
  lessonId: string,
) {
  return `${subjectId}/${lessonId}/${crypto.randomUUID()}.pdf`;
}

export function isLessonReadingPdfPath(
  path: string,
  subjectId: string,
  lessonId: string,
) {
  if (!uuidPattern.test(subjectId) || !uuidPattern.test(lessonId)) return false;

  const prefix = `${subjectId}/${lessonId}/`;
  const fileName = path.slice(prefix.length);

  return (
    path.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.pdf$/i.test(fileName) &&
    !fileName.includes("/")
  );
}

export function hasPdfSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
