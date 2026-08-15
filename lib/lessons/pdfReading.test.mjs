import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPdfSignature,
  isLessonReadingPdfPath,
  isPdfFileMetadata,
  LESSON_READING_PDF_MAX_BYTES,
} from "./pdfReading.ts";

const subjectId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const objectId = "33333333-3333-4333-8333-333333333333";

test("accepts valid PDF metadata within the Stage 1 size limit", () => {
  assert.equal(
    isPdfFileMetadata({
      fileName: "lesson.pdf",
      contentType: "application/pdf",
      size: LESSON_READING_PDF_MAX_BYTES,
    }),
    true,
  );
});

test("rejects wrong types and oversized uploads", () => {
  assert.equal(
    isPdfFileMetadata({
      fileName: "lesson.txt",
      contentType: "text/plain",
      size: 100,
    }),
    false,
  );
  assert.equal(
    isPdfFileMetadata({
      fileName: "lesson.pdf",
      contentType: "application/pdf",
      size: LESSON_READING_PDF_MAX_BYTES + 1,
    }),
    false,
  );
});

test("recognises the PDF signature", () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(hasPdfSignature(new TextEncoder().encode("not pdf")), false);
});

test("only accepts object paths scoped to the subject and lesson", () => {
  const path = `${subjectId}/${lessonId}/${objectId}.pdf`;
  assert.equal(isLessonReadingPdfPath(path, subjectId, lessonId), true);
  assert.equal(
    isLessonReadingPdfPath(path, subjectId, objectId),
    false,
  );
});
