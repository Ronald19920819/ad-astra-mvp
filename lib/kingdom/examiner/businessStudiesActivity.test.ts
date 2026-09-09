import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/kingdom/examiner/businessStudiesActivity.ts imports "server-only"
// directly and cannot be invoked in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("lib/kingdom/examiner/businessStudiesActivity.ts", "utf8");

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- EXAMINER

test("the marking prompt gives explicit method-credit / error-carried-forward instructions for calculation questions", () => {
  const promptBlock = SOURCE.match(/prompt: `Rules:[\s\S]*?`,/)?.[0];
  assert.ok(promptBlock, "marking prompt not found");
  assert.match(promptBlock, /questionType is "calculation"/);
  assert.match(promptBlock, /do not award 0 marks solely because the final number is incorrect if the method was sound/);
  assert.match(promptBlock, /Do not award method credit for an invented formula, unsupported guessing/);
});

test("the marking prompt tolerates equivalent currency/percentage/rounding formatting without becoming an unlimited tolerance", () => {
  const promptBlock = SOURCE.match(/prompt: `Rules:[\s\S]*?`,/)?.[0];
  assert.ok(promptBlock);
  assert.match(promptBlock, /currency symbol, thousands separators, equivalent decimal\/percentage form, or a reasonable rounding difference/);
  assert.match(promptBlock, /Do not extend this tolerance to a genuinely wrong figure/);
  assert.match(promptBlock, /unless the question is specifically assessing the unit or that exact precision/);
});

test("the marking prompt asks for a plain-language explanation of the specific numerical/method error", () => {
  const promptBlock = SOURCE.match(/prompt: `Rules:[\s\S]*?`,/)?.[0];
  assert.ok(promptBlock);
  assert.match(promptBlock, /explain the specific numerical or method error in plain language/);
});

// REGRESSION -- the response schema and its validation are untouched: no
// new required field was added for method credit, since awardedMark is
// already a free 0..maximumMark integer and "partially_correct" already
// exists as a judgement value.

test("regression: awardedMark is still validated as any integer from 0 to the question's maximumMark -- no separate mark-breakdown field was introduced", () => {
  assert.match(SOURCE, /typeof awardedMark !== "number" \|\|/);
  assert.match(SOURCE, /!Number\.isInteger\(awardedMark\) \|\|/);
  assert.match(SOURCE, /awardedMark < 0 \|\|/);
  assert.match(SOURCE, /awardedMark > officialQuestion\.maximumMark \|\|/);
  assert.doesNotMatch(SOURCE, /methodMark|arithmeticMark|markBreakdown/);
});

test("regression: the three-judgement enum (correct/partially_correct/incorrect) is unchanged", () => {
  assert.match(
    SOURCE,
    /judgement !== "correct" &&\s*\n\s*judgement !== "partially_correct" &&\s*\n\s*judgement !== "incorrect"/,
  );
});

test("regression: expectedAnswer (activity_questions.answer_text) is still passed through generically for every question type, not just calculation -- no type-branch was added to how it is read", () => {
  assert.match(SOURCE, /expectedAnswer: string \| null;/);
  assert.doesNotMatch(SOURCE, /questionType === "calculation"/);
});
