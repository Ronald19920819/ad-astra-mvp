import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via createSupabaseAdminClient
// and other server-only helpers) and cannot be invoked directly in a plain
// node:test run -- see lib/supabase/coinLedger.test.ts's header comment
// for the established precedent. These tests verify the real source
// directly.

const SOURCE = readFileSync("app/api/kingdom/mark-activity/route.ts", "utf8");

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- SUBMISSION FLOW
// REGRESSION: this route was already fully generic -- it reads
// activity_questions.answer_text for every question type and passes it to
// the Examiner as expectedAnswer, with no per-type branching. A
// Calculation question's marking key therefore reaches the Examiner
// automatically, with zero code changes required in this route.

test("regression: activity_questions.answer_text is selected and passed through to the Examiner as expectedAnswer for every question type -- no questionType branch gates this", () => {
  assert.match(SOURCE, /answer_text,\s*\n\s*display_order,/);
  assert.match(SOURCE, /expectedAnswer: question\.answer_text,/);
  assert.doesNotMatch(SOURCE, /questionType === "calculation"/);
});

test("regression: the immutable submission snapshot never includes answer_text -- only questionType, questionText, marks, assessmentObjective and guidance are frozen for display", () => {
  const snapshotQuestionsBlock = SOURCE.match(
    /questions: officialQuestions\.map\(\(question\) => \(\{[\s\S]*?\}\)\),/,
  )?.[0];
  assert.ok(snapshotQuestionsBlock, "snapshot questions mapping not found");
  assert.doesNotMatch(snapshotQuestionsBlock, /answer_text/);
  assert.match(snapshotQuestionsBlock, /questionType: question\.question_type,/);
});

test("regression: the learner's submitted answer is still persisted and re-read as plain answer_text on activity_submission_answers, unaffected by the new activity_questions.answer_text column usage", () => {
  assert.match(SOURCE, /answer_text: answer\.answerText\.trim\(\),/);
  assert.match(SOURCE, /\.select\("id, submission_id, question_id, answer_text"\)/);
});

test("regression: preliminary_mark/preliminary_total/preliminary_percentage are still taken directly from markingResult, computed generically across every question's maximumMark -- no separate Calculation total", () => {
  assert.match(SOURCE, /preliminary_mark: markingResult\.preliminaryMark,/);
  assert.match(SOURCE, /preliminary_total: markingResult\.totalMarks,/);
  assert.match(SOURCE, /preliminary_percentage: markingResult\.percentage,/);
});
