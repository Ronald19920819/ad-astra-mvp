import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component -- verified via source inspection, matching
// this codebase's established convention.

const SOURCE = readFileSync("components/subjects/SubjectActivityPage.tsx", "utf8");

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- LEARNER RENDERING
// REGRESSION: no new UI was built for Calculation. It reuses the existing
// generic textarea answer input, which already supports multi-line
// working (formula / substitution / final answer on separate lines) --
// there is no numeric-only <input> anywhere in this page.

test("the learner answer input is a plain multi-line textarea bound to the active question, not a numeric-only <input>", () => {
  const answerBlock = SOURCE.match(
    /<textarea[\s\S]*?value=\{answers\[activeQuestion\.id\] \?\? ""\}[\s\S]*?\/>/,
  )?.[0];
  assert.ok(answerBlock, "learner answer textarea not found");
  assert.doesNotMatch(answerBlock, /type="number"/);
});

test("guidance and question_type are never rendered as learner-visible text -- guidance stays a Kingdom/marking input only, and no per-type UI branch was introduced for Calculation", () => {
  assert.doesNotMatch(SOURCE, /activeQuestion\.guidance/);
  assert.doesNotMatch(SOURCE, /activeQuestion\.question_type/);
});

test("question rendering is driven generically by marks and question_text for every type -- no questionType conditional selects a different answer widget", () => {
  assert.match(SOURCE, /\{activeQuestion\.marks\}\{" "\}/);
  assert.match(SOURCE, /\{activeQuestion\.question_text\}/);
  assert.doesNotMatch(SOURCE, /activeQuestion\.question_type ===/);
});

// REGRESSION -- the learner-facing question query never selects
// answer_text (the confidential marking key), for any question type.

test("regression: this page never reads activity_questions.answer_text (the confidential marking key) off a question -- the only answer_text/answerText usage here is the learner's own submitted answer on activity_submission_answers", () => {
  assert.doesNotMatch(SOURCE, /question\.answer_text|activeQuestion\.answer_text|\.answerText\b/);
  // Sanity check the pattern above isn't vacuously passing: the learner's
  // own submitted-answer field (a different table/column) is expected to
  // still be present, keyed off "answer" not "question".
  assert.match(SOURCE, /answer\.answer_text/);
});
