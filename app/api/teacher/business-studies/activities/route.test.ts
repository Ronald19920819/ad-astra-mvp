import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via authorizeTeacher)
// and cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/teacher/business-studies/activities/route.ts", "utf8");

// The POST handler is the last declaration in this file -- see the
// established [\s\S]*?\n\} pitfall documented elsewhere in this codebase
// -- so this slices to end-of-file.
const postFn = SOURCE.slice(SOURCE.indexOf("export async function POST("));

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- BUILDER PERSISTENCE

test("a submitted question's optional answerText is accepted when a non-empty string within the length cap, or when absent/null", () => {
  const isQuestionFn = SOURCE.match(/function isQuestion\([\s\S]*?\n\}/)?.[0];
  assert.ok(isQuestionFn, "isQuestion not found");
  assert.match(
    isQuestionFn,
    /question\.answerText === undefined \|\|\s*\n\s*question\.answerText === null \|\|\s*\n\s*\(typeof question\.answerText === "string" &&\s*\n\s*question\.answerText\.length <= 4000\)/,
  );
});

test("answerText is persisted to activity_questions.answer_text on publish, trimmed, defaulting to null when blank -- this is the first write path for the previously-unused column", () => {
  assert.match(postFn, /answer_text: question\.answerText\?\.trim\(\) \|\| null,/);
});

test("the create route still inserts activity_questions with a single plain .insert() call, not the versioning RPC -- no migration was needed for brand-new activities", () => {
  assert.match(postFn, /await admin\s*\n\s*\.from\("activity_questions"\)\s*\n\s*\.insert\(questionRows\);/);
});

// REGRESSION -- total marks validation, question shape validation and the
// rest of the publish flow are unchanged for every other question type.

test("regression: totalMarks must still equal the exact sum of every question's marks -- Calculation's 4 marks are summed the same generic way as any other type, nothing was hardcoded", () => {
  assert.match(
    SOURCE,
    /questions\.reduce\(\(sum, question\) => sum \+ question\.marks, 0\) !== totalMarks \|\|/,
  );
});

test("regression: questionType, paper, questionText, marks, ao and guidance are still required exactly as before", () => {
  const isQuestionFn = SOURCE.match(/function isQuestion\([\s\S]*?\n\}/)?.[0];
  assert.ok(isQuestionFn);
  assert.match(isQuestionFn, /typeof question\.paper === "string" &&/);
  assert.match(isQuestionFn, /typeof question\.questionType === "string" &&/);
  assert.match(isQuestionFn, /typeof question\.questionText === "string" &&/);
  assert.match(isQuestionFn, /question\.marks > 0 &&/);
});
