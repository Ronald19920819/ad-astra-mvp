import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via authorizeTeacher)
// and cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/kingdom/generate-activity/route.ts", "utf8");

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- AUTHOR VALIDATION

test("findCalculationValidationIssue is a no-op for every question type except calculation", () => {
  const fn = SOURCE.match(/function findCalculationValidationIssue\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "findCalculationValidationIssue not found");
  assert.match(fn, /if \(plannedQuestionType !== "calculation"\) return null;/);
});

test("a calculation question is rejected if its question text contains no numeral at all -- Kingdom must supply the figures needed to solve it", () => {
  const fn = SOURCE.match(/function findCalculationValidationIssue\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn, /if \(!\/\\d\/\.test\(questionText\)\)/);
});

test("a calculation question is rejected if Kingdom returned no marking key (formula/substitution/expected result) -- fails validation rather than publishing", () => {
  const fn = SOURCE.match(/function findCalculationValidationIssue\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn, /if \(!answerText\.trim\(\)\)/);
});

test("a calculation question is rejected if the returned marking key has no determinable numerical result", () => {
  const fn = SOURCE.match(/function findCalculationValidationIssue\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn, /if \(!\/\\d\/\.test\(answerText\)\)/);
});

test("a calculation validation failure is folded into the exact same integrityIssues / 422 rejection path used for evidence-integrity failures -- no separate error/regenerate mechanism was invented", () => {
  const postFn = SOURCE.slice(SOURCE.indexOf("export async function POST("));
  assert.match(
    postFn,
    /const calculationIssue = findCalculationValidationIssue\(\s*\n\s*plannedQuestion\.questionType,\s*\n\s*generatedQuestion,\s*\n\s*\);/,
  );
  assert.match(postFn, /integrityIssues\.push\(\s*\n\s*`Question \$\{generatedQuestion\.id\} could not be generated because \$\{calculationIssue\}\.`,/);
  assert.match(postFn, /if \(integrityIssues\.length > 0\) \{/);
  assert.match(postFn, /status: 422/);
});

test("a calculation question's generated marking key is returned to the client as answerText, trimmed, so the builder can carry it through to publish; every other question type gets null", () => {
  const postFn = SOURCE.slice(SOURCE.indexOf("export async function POST("));
  assert.match(
    postFn,
    /answerText: question\.answerText\?\.trim\(\) \|\| null,/,
  );
});

// REGRESSION -- the calculation check only ever runs after a question
// already passed the pre-existing evidence-integrity self-report check,
// so no existing question type's acceptance path was reordered.

test("regression: the calculation check runs after (not instead of) the existing evidence-integrity result check for every question", () => {
  const postFn = SOURCE.slice(SOURCE.indexOf("export async function POST("));
  const integrityCheckIndex = postFn.indexOf("if (!result.ok) {");
  const calculationCheckIndex = postFn.indexOf("const calculationIssue =");
  assert.ok(integrityCheckIndex > -1 && calculationCheckIndex > -1);
  assert.ok(integrityCheckIndex < calculationCheckIndex);
});
