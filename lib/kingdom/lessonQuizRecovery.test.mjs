import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const teacherPageSource = readFileSync(
  join(repoRoot, "components", "subjects", "TeacherSubjectClassroomPage.tsx"),
  "utf8",
);
const quizRouteSource = readFileSync(
  join(repoRoot, "app", "api", "kingdom", "generate-lesson-quiz", "route.ts"),
  "utf8",
);
const readingHelperSource = readFileSync(
  join(repoRoot, "lib", "kingdom", "lessonReadingGeneration.ts"),
  "utf8",
);
const teacherQuizRequestMatch = teacherPageSource.match(
  /const askKingdomForQuiz = async \(\) => \{[\s\S]*?const data = await response\.json\(\);/,
);
const teacherQuizRequestSource = teacherQuizRequestMatch?.[0] ?? "";

test("teacher quiz request uses the saved lesson id and no longer posts browser reading text", () => {
  assert.notEqual(teacherQuizRequestSource, "");
  assert.match(teacherQuizRequestSource, /body:\s*JSON\.stringify\(\{\s*subjectKey,\s*lessonId,\s*\}\)/s);
  assert.doesNotMatch(teacherQuizRequestSource, /readingTitle:\s*readingTitle\.trim\(\)/);
  assert.doesNotMatch(teacherQuizRequestSource, /readingText:\s*quizReadingText/);
  assert.match(teacherQuizRequestSource, /Save the reading before asking Kingdom\./);
});

test("teacher page removes the obsolete PDF Stage 1 quiz block", () => {
  assert.doesNotMatch(teacherPageSource, /PDF quiz generation will be available in Stage 2/i);
  assert.doesNotMatch(teacherPageSource, /automatic quiz generation for PDFs are not available in Stage 1/i);
  assert.match(teacherPageSource, /Kingdom can now generate quiz questions from the saved PDF reading\./);
});

test("quiz route resolves the saved lesson reading from lessonId", () => {
  assert.match(quizRouteSource, /typeof body\.lessonId === "string" \? body\.lessonId\.trim\(\) : ""/);
  assert.match(quizRouteSource, /resolveAuthoritativeLessonReading\(\{[\s\S]*lessonId,[\s\S]*lessonStatusMode: "draft-or-published"/);
  assert.match(quizRouteSource, /readingSourceType = resolvedReading\.reading\.sourceType;/);
});

test("saved text readings and saved PDFs are both supplied to OpenAI through the authoritative helper", () => {
  assert.match(quizRouteSource, /buildOpenAIReadingInput\(\{[\s\S]*resolvedReading,[\s\S]*pdfDetail: "auto"/);
  assert.match(readingHelperSource, /Authoritative saved lesson reading:/);
  assert.match(readingHelperSource, /type:\s*"input_file"/);
  assert.match(readingHelperSource, /file_id:\s*uploadedFile\.id/);
  assert.doesNotMatch(readingHelperSource, /file_id:\s*uploadedFile\.id,\s*filename,/);
  assert.match(readingHelperSource, /Use the attached PDF as the authoritative saved lesson reading\./);
});

test("quiz route keeps PDF failures teacher-facing instead of returning raw backend errors", () => {
  assert.match(quizRouteSource, /Kingdom could not process the saved PDF reading\. Please try again or replace the PDF if the problem continues\./);
  assert.match(quizRouteSource, /return toLessonQuizErrorResponse\(error, readingSourceType\);/);
});
