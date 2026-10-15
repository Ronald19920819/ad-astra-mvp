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

// AD ASTRA -- LIBRARY CLUB (STAGE C): builds a human-readable download
// filename entirely from already-canonical subject/lesson metadata --
// never from a client-supplied value. Strips path separators, the
// characters Windows/most filesystems and Content-Disposition both
// forbid, and any control character (including \r/\n, which is what
// would let a crafted title inject a second HTTP header) before joining
// the parts. The result always ends in exactly one ".pdf" extension.
const UNSAFE_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001F]/g;

function sanitizeFilenamePart(value: string) {
  return value
    .replace(UNSAFE_FILENAME_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLibraryReadingDownloadFilename(
  subjectDisplayName: string,
  lessonNumber: string,
  lessonTitle: string,
) {
  const sanitizedLessonNumber = sanitizeFilenamePart(lessonNumber);

  const parts = [
    sanitizeFilenamePart(subjectDisplayName),
    sanitizedLessonNumber ? `Lesson ${sanitizedLessonNumber}` : "",
    sanitizeFilenamePart(lessonTitle),
  ].filter((part) => part.length > 0);

  const baseName = parts.join(" - ") || "AD Astra Library Club Reading";
  return `${baseName}.pdf`;
}

// AD ASTRA -- LIBRARY CLUB (STAGE C): the two pure eligibility checks
// behind resolveAuthorizedLibraryReading (lib/supabase/libraryPdfAccess.ts).
// Deliberately kept here, in a module with no "server-only" import, so
// they can be exercised directly with real imports in a plain node:test
// run (this codebase has no established Supabase-client-mocking
// convention, so this is the genuinely-behavioural alternative to a
// source-string assertion for this decision logic) rather than merely
// re-implemented/mirrored inside a test file.

export function isPublishedLessonForSubject(
  lesson: { status: string; subject_id: string } | null | undefined,
  expectedSubjectId: string,
): boolean {
  return Boolean(
    lesson && lesson.status === "published" && lesson.subject_id === expectedSubjectId,
  );
}

export function isEligibleLibraryReadingMaterial(
  material:
    | {
        lesson_id: string;
        material_type: string;
        source_type: string;
        content_url: string | null;
      }
    | null
    | undefined,
  expectedLessonId: string,
  expectedSubjectId: string,
): boolean {
  if (!material) return false;

  return (
    material.lesson_id === expectedLessonId &&
    material.material_type === "reading" &&
    material.source_type === "pdf" &&
    typeof material.content_url === "string" &&
    isLessonReadingPdfPath(material.content_url, expectedSubjectId, expectedLessonId)
  );
}
