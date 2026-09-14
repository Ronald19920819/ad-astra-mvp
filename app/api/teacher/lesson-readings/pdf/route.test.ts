import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via authorizeTeacher ->
// lib/supabase/teacherAuth.ts, and logAuthDiagnostic ->
// lib/observability/authDiagnostics.ts) and cannot be invoked directly in
// a plain node:test run -- see lib/supabase/coinLedger.test.ts's header
// comment for the established precedent. These tests verify the real
// source directly.

const SOURCE = readFileSync(
  "app/api/teacher/lesson-readings/pdf/route.ts",
  "utf8",
);
const GET_AUTHORIZED_LESSON_FN = SOURCE.slice(
  SOURCE.indexOf("async function getAuthorizedLesson("),
  SOURCE.indexOf("async function verifyStoredPdf("),
);
const POST_FN = SOURCE.slice(SOURCE.indexOf("export async function POST("));

// AD ASTRA -- CLOSE TEACHER WRITE DIAGNOSTIC BLIND SPOT: the generic
// catch-all previously logged "Lesson PDF reading save failed:" with no
// requestId and no indication of which internal step failed. It is now
// instrumented with the shared logAuthDiagnostic helper (same
// requestId-correlated, safe-fields-only shape already used by
// authorizeTeacher/getAuthenticatedTeacherProfile) without changing any
// returned status/error text.

test("D: the catch-all now logs via the shared logAuthDiagnostic helper, not a bare console.error, so the failure carries a requestId", () => {
  assert.doesNotMatch(
    POST_FN,
    /console\.error\("Lesson PDF reading save failed:"/,
  );
  assert.match(
    POST_FN,
    /await logAuthDiagnostic\(\s*\n\s*"Lesson PDF reading save failed:",\s*\n\s*`lesson-pdf\.\$\{stage\}`,\s*\n\s*`action_\$\{actionForDiagnostics\}`,\s*\n\s*error,\s*\n\s*\);/,
  );
});

test("C: teacher_authorization and the lesson lookup/authorization are tracked as two distinct stages inside getAuthorizedLesson", () => {
  assert.match(
    GET_AUTHORIZED_LESSON_FN,
    /setStage\("teacher_authorization"\);\s*\n\s*const authorization = await authorizeTeacher\(subjectId\);/,
  );
  assert.match(
    GET_AUTHORIZED_LESSON_FN,
    /setStage\("lesson_authorization_lookup"\);\s*\n\s*const \{ data: lesson, error \} = await authorization\.teacher\.admin/,
  );
});

test("C: signed upload preparation, PDF validation, and the reading metadata lookup/write are each tracked as their own stage", () => {
  assert.match(
    POST_FN,
    /stage = "signed_upload_preparation";\s*\n\s*const \{ data, error \} = await admin\.storage/,
  );
  assert.match(
    POST_FN,
    /stage = "pdf_validation";\s*\n\s*if \(!\(await verifyStoredPdf\(admin, path\)\)\) \{/,
  );
  assert.match(
    POST_FN,
    /stage = "reading_metadata_lookup";\s*\n\s*const \{ data: existing, error: existingError \} = await admin/,
  );
  assert.match(
    POST_FN,
    /stage = "reading_metadata_write";\s*\n\s*const result = existing/,
  );
});

test("D: the stage tracker is threaded from getAuthorizedLesson into the POST handler via a callback, not a competing correlation mechanism", () => {
  assert.match(
    POST_FN,
    /const lessonAccess = await getAuthorizedLesson\(body, \(nextStage\) => \{\s*\n\s*stage = nextStage;\s*\n\s*\}\);/,
  );
});

test("F: only the shared toSafeErrorDetails-backed helper receives the raw error -- no token, cookie, or session value is logged directly by this route", () => {
  assert.doesNotMatch(POST_FN, /accessToken|refreshToken|authorization header|cookie/i);
});

test("regression: the teacher-facing error message for the generic catch-all is unchanged", () => {
  assert.match(
    POST_FN,
    /\{ error: "The PDF reading could not be saved\." \}/,
  );
});

test("regression: authorizeTeacher is still called with subjectId inside getAuthorizedLesson and its structured failure is still returned as-is", () => {
  assert.match(
    GET_AUTHORIZED_LESSON_FN,
    /const authorization = await authorizeTeacher\(subjectId\);\s*\n\s*if \(!authorization\.success\) \{\s*\n\s*return \{ response: teacherAuthorizationResponse\(authorization\) \};\s*\n\s*\}/,
  );
});

test("regression: PDF signature verification (verifyStoredPdf) and the invalid-PDF response are unchanged", () => {
  assert.match(SOURCE, /return hasPdfSignature\(bytes\);/);
  assert.match(POST_FN, /invalid\("The uploaded file is not a valid PDF\."\)/);
});
