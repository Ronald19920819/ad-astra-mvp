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
  "app/api/teacher/business-studies/lessons/route.ts",
  "utf8",
);
const POST_FN = SOURCE.slice(SOURCE.indexOf("export async function POST("));

// AD ASTRA -- CLOSE TEACHER WRITE DIAGNOSTIC BLIND SPOT: the generic
// catch-all previously logged "Subject lesson write failed:" with no
// requestId and no indication of which internal step failed. It is now
// instrumented with the shared logAuthDiagnostic helper (same
// requestId-correlated, safe-fields-only shape already used by
// authorizeTeacher/getAuthenticatedTeacherProfile) without changing any
// returned status/code/error text.

test("D: the catch-all now logs via the shared logAuthDiagnostic helper, not a bare console.error, so the failure carries a requestId", () => {
  assert.doesNotMatch(POST_FN, /console\.error\("Subject lesson write failed:"/);
  assert.match(
    POST_FN,
    /await logAuthDiagnostic\(\s*\n\s*"Subject lesson write failed:",\s*\n\s*`lesson-write\.\$\{stage\}`,\s*\n\s*`action_\$\{actionForDiagnostics\}`,\s*\n\s*error,\s*\n\s*\);/,
  );
});

test("B: teacher_authorization is the tracked stage before authorizeTeacher() runs", () => {
  assert.match(
    POST_FN,
    /stage = "teacher_authorization";\s*\n\s*const authorization = await authorizeTeacher\(subjectId\);/,
  );
});

test("B: topic/ownership lookup is tracked as its own stage in both the create and details actions, distinct from the write that follows it", () => {
  const topicStageOccurrences = POST_FN.match(
    /stage = "topic_ownership_lookup";\s*\n\s*if \(!\(await topicBelongsToSubject\(topicId\)\)\) \{/g,
  );
  assert.equal(
    topicStageOccurrences?.length,
    2,
    "expected topic_ownership_lookup to be tracked once in 'create' and once in 'details'",
  );
});

test("B: lesson lookup/create/update are each tracked as distinguishable stages", () => {
  assert.match(
    POST_FN,
    /stage = "lesson_create_write";\s*\n\s*const \{ data, error \} = await admin\s*\n\s*\.from\("lessons"\)\s*\n\s*\.insert\(/,
  );
  assert.match(
    POST_FN,
    /stage = "lesson_lookup";\s*\n\s*const \{ data: lesson, error: lessonError \} = await admin/,
  );
  assert.match(
    POST_FN,
    /stage = "lesson_details_write";\s*\n\s*const lessonUpdates:/,
  );
  assert.match(
    POST_FN,
    /stage = "lesson_status_write";\s*\n\s*const \{ data, error \} = await admin\s*\n\s*\.from\("lessons"\)\s*\n\s*\.update\(\{ status: body\.status \}\)/,
  );
});

test("B: material and quiz content writes are tracked as their own stages", () => {
  assert.match(
    POST_FN,
    /stage = "lesson_material_write";\s*\n\s*const \{ data: existing, error: existingError \} = await admin\s*\n\s*\.from\("lesson_materials"\)/,
  );
  assert.match(POST_FN, /stage = "lesson_quiz_lookup";/);
  const quizWriteOccurrences = POST_FN.match(/stage = "lesson_quiz_write";/g);
  assert.equal(
    quizWriteOccurrences?.length,
    2,
    "expected lesson_quiz_write to be tracked for both the existing-quiz update path and the new-quiz insert path",
  );
});

test("D: the failed action is captured for diagnostics as soon as it is validated, without altering the validation itself", () => {
  assert.match(
    POST_FN,
    /if \(!isRecord\(body\) \|\| typeof body\.action !== "string"\) \{\s*\n\s*return invalid\("A valid lesson action is required\."\);\s*\n\s*\}\s*\n\s*actionForDiagnostics = body\.action;/,
  );
});

test("F: only the shared toSafeErrorDetails-backed helper receives the raw error -- no token, cookie, or session value is logged directly by this route", () => {
  assert.doesNotMatch(POST_FN, /accessToken|refreshToken|authorization header|cookie/i);
});

test("regression: none of the three teacher-facing messages changed", () => {
  assert.match(
    POST_FN,
    /\{ error: "The lesson change could not be saved\.", code: "SAVE_FAILED" \}/,
  );
  assert.match(
    POST_FN,
    /invalid\(`Select a valid \$\{subject\.displayName\} topic\.`\)/,
  );
  assert.match(
    POST_FN,
    /error: `The \$\{subject\.displayName\} lesson was not found\.`, code: "NOT_FOUND"/,
  );
});

test("regression: authorizeTeacher is still called with subjectId and its structured failure is still returned as-is (not swallowed into the generic catch)", () => {
  assert.match(
    POST_FN,
    /const authorization = await authorizeTeacher\(subjectId\);\s*\n\s*if \(!authorization\.success\) \{\s*\n\s*return teacherAuthorizationResponse\(authorization\);\s*\n\s*\}/,
  );
});
