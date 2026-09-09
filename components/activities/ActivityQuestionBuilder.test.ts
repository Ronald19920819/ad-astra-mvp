import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component -- verified via source inspection, matching this
// codebase's established convention for such components.

const SOURCE = readFileSync("components/activities/ActivityQuestionBuilder.tsx", "utf8");

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- BUILDER

test("Calculation appears as a selectable Business Studies Paper 1 option with the correct internal value and teacher-facing label", () => {
  assert.match(SOURCE, /<option value="calculation">Calculation – 4 marks<\/option>/);
});

test("Calculation is offered only inside the Paper 1 option block, not the Paper 2 block", () => {
  const paper1Block = SOURCE.match(
    /question\.paper === "paper-1" \? \(\s*\n\s*<>([\s\S]*?)<\/>/,
  )?.[1];
  assert.ok(paper1Block, "paper-1 option block not found");
  assert.match(paper1Block, /value="calculation"/);

  const paper2Block = SOURCE.match(
    /\) : \(\s*\n\s*<>([\s\S]*?)<\/>\s*\n\s*\)\)}/,
  )?.[1];
  assert.ok(paper2Block, "paper-2 option block not found");
  assert.doesNotMatch(paper2Block, /value="calculation"/);
});

test("the ActivityQuestion type carries an optional answerText field for the confidential Calculation marking key, kept separate from the visible questionText", () => {
  const typeBlock = SOURCE.match(/export type ActivityQuestion = \{[\s\S]*?\n\};/)?.[0];
  assert.ok(typeBlock, "ActivityQuestion type not found");
  assert.match(typeBlock, /answerText\?: string \| null;/);
});

test("selecting the calculation type still resolves marks/AO/opening/guidance from the shared preset -- no separate hardcoded path was added for it", () => {
  assert.doesNotMatch(SOURCE, /calculation:\s*\{\s*\n\s*marks:/);
});

// REGRESSION -- every pre-existing Business Studies option is unchanged.

test("regression: every pre-existing Business Studies Paper 1 and Paper 2 option is still present and unchanged", () => {
  assert.match(SOURCE, /<option value="define">Define – 2 marks<\/option>/);
  assert.match(SOURCE, /<option value="identify-two">Identify two – 2 marks<\/option>/);
  assert.match(SOURCE, /<option value="outline">Outline two – 4 marks<\/option>/);
  assert.match(SOURCE, /<option value="explain-two">Explain two – 6 marks<\/option>/);
  assert.match(SOURCE, /<option value="justify">Justify – 6 marks<\/option>/);
  assert.match(SOURCE, /Explain in context – 8 marks/);
  assert.match(SOURCE, /Consider and justify – 12 marks/);
  assert.match(SOURCE, /Recommend and justify – 12 marks/);
});

test("regression: Total Marks is still derived generically by summing every question's marks -- no separate hardcoded total for calculation questions", () => {
  assert.match(
    SOURCE,
    /const totalMarks = questions\.reduce\(\s*\n\s*\(total, question\) => total \+ Number\(question\.marks \|\| 0\),/,
  );
});
