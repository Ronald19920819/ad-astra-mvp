import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestionEvidenceRequirement,
  subjectQuestionPresets,
} from "./questionPresets.ts";

// AD ASTRA BUSINESS STUDIES CALCULATION QUESTION TYPE -- BUILDER

test("Calculation is a real, dedicated Business Studies question type with a stable internal identifier and the required label/marks", () => {
  const calculation = subjectQuestionPresets["business-studies"].questionTypes.calculation;
  assert.ok(calculation, "calculation question type not found");
  assert.equal(calculation.label, "Calculation - 4 marks");
  assert.equal(calculation.marks, 4);
  assert.equal(calculation.paper, "paper-1");
});

test("Calculation carries no case-study evidence requirement -- it is a Paper 1 type, not a Data Interpretation/Paper 2 type", () => {
  const requirement = getQuestionEvidenceRequirement("business-studies", "calculation");
  assert.equal(requirement, undefined);
});

test("business-studies-igcse-1 shares the same preset object as business-studies, so Calculation is available there too", () => {
  assert.equal(
    subjectQuestionPresets["business-studies-igcse-1"].questionTypes.calculation,
    subjectQuestionPresets["business-studies"].questionTypes.calculation,
  );
});

// REGRESSION -- existing Business Studies question types are unchanged,
// and no other subject's builder was touched.

test("regression: every pre-existing Business Studies question type keeps its exact label, paper and marks", () => {
  const types = subjectQuestionPresets["business-studies"].questionTypes;
  assert.deepEqual(
    { label: types.define.label, paper: types.define.paper, marks: types.define.marks },
    { label: "Define - 2 marks", paper: "paper-1", marks: 2 },
  );
  assert.deepEqual(
    { label: types["identify-two"].label, paper: types["identify-two"].paper, marks: types["identify-two"].marks },
    { label: "Identify two - 2 marks", paper: "paper-1", marks: 2 },
  );
  assert.deepEqual(
    { label: types.outline.label, paper: types.outline.paper, marks: types.outline.marks },
    { label: "Outline two - 4 marks", paper: "paper-1", marks: 4 },
  );
  assert.deepEqual(
    { label: types["explain-two"].label, paper: types["explain-two"].paper, marks: types["explain-two"].marks },
    { label: "Explain two - 6 marks", paper: "paper-1", marks: 6 },
  );
  assert.deepEqual(
    { label: types.justify.label, paper: types.justify.paper, marks: types.justify.marks },
    { label: "Justify - 6 marks", paper: "paper-1", marks: 6 },
  );
  assert.equal(types["explain-context"].evidenceRequirement.specialSource, true);
  assert.equal(types["consider-justify"].evidenceRequirement.specialSource, true);
  assert.equal(types.recommend.evidenceRequirement.specialSource, true);
});

test("regression: English, Afrikaans and History presets have no 'calculation' question type -- this feature only touched Business Studies", () => {
  assert.equal(subjectQuestionPresets.english.questionTypes.calculation, undefined);
  assert.equal(subjectQuestionPresets.afrikaans.questionTypes.calculation, undefined);
  assert.equal(subjectQuestionPresets.history.questionTypes.calculation, undefined);
});
