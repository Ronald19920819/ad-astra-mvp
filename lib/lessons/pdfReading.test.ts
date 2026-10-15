import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLessonReadingPdfPath,
  buildLibraryReadingDownloadFilename,
  isEligibleLibraryReadingMaterial,
  isLessonReadingPdfPath,
  isPublishedLessonForSubject,
} from "./pdfReading";

// This module has no "server-only" import and makes no Supabase/network
// call -- every function here is pure, so these are genuine behavioural
// tests against the real, unmirrored production code (not source-string
// assertions and not a mirrored copy), satisfying Stage C's preference
// for behavioural tests wherever the underlying code genuinely allows it.

const SUBJECT_A = "11111111-1111-4111-8111-111111111111";
const SUBJECT_B = "22222222-2222-4222-8222-222222222222";
const LESSON_A = "33333333-3333-4333-8333-333333333333";
const LESSON_B = "44444444-4444-4444-8444-444444444444";

// --- isPublishedLessonForSubject (test items 2, 10, 11, 12, 13) -------

test("11/12/13: a missing/null lesson is not eligible", () => {
  assert.equal(isPublishedLessonForSubject(null, SUBJECT_A), false);
  assert.equal(isPublishedLessonForSubject(undefined, SUBJECT_A), false);
});

test("11: a draft lesson is rejected even when it belongs to the correct subject", () => {
  assert.equal(
    isPublishedLessonForSubject({ status: "draft", subject_id: SUBJECT_A }, SUBJECT_A),
    false,
  );
});

test("12: a lesson that was published but is no longer (any non-'published' status) is rejected", () => {
  assert.equal(
    isPublishedLessonForSubject({ status: "archived", subject_id: SUBJECT_A }, SUBJECT_A),
    false,
  );
});

test("10: a published lesson belonging to a DIFFERENT subject than requested is rejected -- this is the exact cross-subject check", () => {
  assert.equal(
    isPublishedLessonForSubject({ status: "published", subject_id: SUBJECT_B }, SUBJECT_A),
    false,
  );
});

test("1/19: a published lesson belonging to the exact requested subject is eligible", () => {
  assert.equal(
    isPublishedLessonForSubject({ status: "published", subject_id: SUBJECT_A }, SUBJECT_A),
    true,
  );
});

// --- isEligibleLibraryReadingMaterial (test items 14, 15, 16, 17, 18) --

function makeMaterial(overrides: Partial<{
  lesson_id: string;
  material_type: string;
  source_type: string;
  content_url: string | null;
}> = {}) {
  return {
    lesson_id: LESSON_A,
    material_type: "reading",
    source_type: "pdf",
    content_url: `${SUBJECT_A}/${LESSON_A}/${crypto.randomUUID()}.pdf`,
    ...overrides,
  };
}

test("14: a missing/null reading material is rejected", () => {
  assert.equal(isEligibleLibraryReadingMaterial(null, LESSON_A, SUBJECT_A), false);
  assert.equal(isEligibleLibraryReadingMaterial(undefined, LESSON_A, SUBJECT_A), false);
});

test("17: a material whose lesson_id does not match the requested lesson is rejected (wrong lesson/material pairing)", () => {
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial({ lesson_id: LESSON_B }), LESSON_A, SUBJECT_A),
    false,
  );
});

test("16: a non-reading material_type is rejected", () => {
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial({ material_type: "video" }), LESSON_A, SUBJECT_A),
    false,
  );
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial({ material_type: "quiz" }), LESSON_A, SUBJECT_A),
    false,
  );
});

test("15: a pasted_text (or any non-pdf) reading source_type is rejected", () => {
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial({ source_type: "pasted_text" }), LESSON_A, SUBJECT_A),
    false,
  );
});

test("18: a content_url that does not match the canonical {subjectId}/{lessonId}/{uuid}.pdf convention is rejected", () => {
  assert.equal(
    isEligibleLibraryReadingMaterial(
      makeMaterial({ content_url: "../../../etc/passwd" }),
      LESSON_A,
      SUBJECT_A,
    ),
    false,
  );
  assert.equal(
    isEligibleLibraryReadingMaterial(
      // Belongs to a different subject/lesson pair than requested, even
      // though it is otherwise a well-formed canonical path.
      makeMaterial({ content_url: `${SUBJECT_B}/${LESSON_B}/${crypto.randomUUID()}.pdf` }),
      LESSON_A,
      SUBJECT_A,
    ),
    false,
  );
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial({ content_url: null }), LESSON_A, SUBJECT_A),
    false,
  );
});

test("19/20: a fully eligible reading material is accepted", () => {
  assert.equal(
    isEligibleLibraryReadingMaterial(makeMaterial(), LESSON_A, SUBJECT_A),
    true,
  );
});

test("21: a replaced canonical path (new random UUID filename, same subject/lesson prefix) is still accepted -- Library Club always evaluates the CURRENT path, never a cached one", () => {
  const replacedPath = buildLessonReadingPdfPath(SUBJECT_A, LESSON_A);
  assert.notEqual(replacedPath, makeMaterial().content_url);
  assert.equal(
    isEligibleLibraryReadingMaterial(
      makeMaterial({ content_url: replacedPath }),
      LESSON_A,
      SUBJECT_A,
    ),
    true,
  );
  assert.equal(isLessonReadingPdfPath(replacedPath, SUBJECT_A, LESSON_A), true);
});

// --- buildLibraryReadingDownloadFilename (test item 23) ----------------

test("23: builds the expected human-readable filename from canonical metadata", () => {
  assert.equal(
    buildLibraryReadingDownloadFilename(
      "English 0861 - Stage 8",
      "3.1",
      "Understanding Narrative Structure",
    ),
    "English 0861 - Stage 8 - Lesson 3.1 - Understanding Narrative Structure.pdf",
  );
});

test("23: strips path separators and filesystem/Content-Disposition-unsafe characters", () => {
  const filename = buildLibraryReadingDownloadFilename(
    'Business/Studies: "Test"',
    "1.1",
    "A <Tricky> Title? | Yes*",
  );
  assert.doesNotMatch(filename, /[\\/:*?"<>|]/);
  assert.match(filename, /\.pdf$/);
});

test("23: strips control characters, including CR/LF, so a crafted title cannot inject a second HTTP header", () => {
  const filename = buildLibraryReadingDownloadFilename(
    "History",
    "2.1",
    "Injected\r\nSet-Cookie: evil=1",
  );
  assert.doesNotMatch(filename, /[\r\n]/);
});

test("23: collapses repeated/internal whitespace and trims each part", () => {
  const filename = buildLibraryReadingDownloadFilename(
    "  English   Stage 8  ",
    " 3.1 ",
    "  Understanding   Narrative  ",
  );
  assert.equal(
    filename,
    "English Stage 8 - Lesson 3.1 - Understanding Narrative.pdf",
  );
});

test("23: always ends in exactly one .pdf extension, even with empty/blank inputs", () => {
  const filename = buildLibraryReadingDownloadFilename("", "", "");
  assert.match(filename, /\.pdf$/);
  assert.equal((filename.match(/\.pdf/g) ?? []).length, 1);
  assert.equal(filename, "AD Astra Library Club Reading.pdf");
});

test("23: a blank lesson number is omitted rather than rendering a bare 'Lesson' segment", () => {
  const filename = buildLibraryReadingDownloadFilename("English", "   ", "A Title");
  assert.doesNotMatch(filename, /Lesson\s*-/);
  assert.equal(filename, "English - A Title.pdf");
});
