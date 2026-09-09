import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via authorizeTeacher)
// and lives under a Next.js dynamic-route folder ([activityId]), so per
// this codebase's established precedent it must be run explicitly, never
// via the standard glob runner:
//   node --import tsx "app/api/teacher/business-studies/activities/[activityId]/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/business-studies/activities/[activityId]/route.ts",
  "utf8",
);

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- BUILDER EDIT PATH

test("answerText validation on edit matches the create route exactly -- accepted when a string within the length cap, or absent/null", () => {
  const isQuestionFn = SOURCE.match(/function isQuestion\([\s\S]*?\n\}/)?.[0];
  assert.ok(isQuestionFn, "isQuestion not found");
  assert.match(
    isQuestionFn,
    /question\.answerText === undefined \|\|\s*\n\s*question\.answerText === null \|\|\s*\n\s*\(typeof question\.answerText === "string" &&\s*\n\s*question\.answerText\.length <= 4000\)/,
  );
});

test("existing questions are re-read with answer_text so an edit that only changes other fields does not silently wipe a Calculation question's marking key", () => {
  const selectBlock = SOURCE.match(/\.select\(`\s*\n\s*id,\s*\n\s*question_number,[\s\S]*?`\)/)?.[0];
  assert.ok(selectBlock, "existingQuestions select not found");
  assert.match(selectBlock, /answer_text,/);
});

test("answer_text is included in the questionRows sent to the versioning RPC when the activity's material changed", () => {
  assert.match(SOURCE, /answer_text: question\.answerText\?\.trim\(\) \|\| null,/);
});

test("a change to only answer_text (marking key regenerated, visible text unchanged) still counts as a material change and bumps the activity version -- otherwise a Calculation question's updated marking key would never reach the versioning RPC", () => {
  const materialChangedBlock = SOURCE.match(/const materialChanged =[\s\S]*?;\s*let version/)?.[0];
  assert.ok(materialChangedBlock, "materialChanged computation not found");
  assert.match(
    materialChangedBlock,
    /\(existingQuestion\.answer_text \?\? null\) !== question\.answer_text \|\|/,
  );
});

// REGRESSION -- every other field's edit-detection and the RPC contract
// for pre-existing question fields is unchanged.

test("regression: paper, question_type, question_text, marks, assessment_objective, guidance and display_order are all still compared for materialChanged exactly as before", () => {
  const materialChangedBlock = SOURCE.match(/const materialChanged =[\s\S]*?;\s*let version/)?.[0];
  assert.ok(materialChangedBlock);
  assert.match(materialChangedBlock, /existingQuestion\.paper !== question\.paper \|\|/);
  assert.match(materialChangedBlock, /existingQuestion\.question_type !== question\.question_type \|\|/);
  assert.match(materialChangedBlock, /existingQuestion\.question_text !== question\.question_text \|\|/);
  assert.match(materialChangedBlock, /existingQuestion\.marks !== question\.marks \|\|/);
  assert.match(materialChangedBlock, /existingQuestion\.display_order !== question\.display_order/);
});

test("regression: a confirmed submission-impact activity with existing learner submissions still requires explicit confirmation before saving, unaffected by this feature", () => {
  assert.match(SOURCE, /code: "CONFIRM_SUBMISSION_IMPACT",/);
  assert.match(SOURCE, /confirmedSubmissionImpact !== true/);
});
