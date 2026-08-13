import assert from "node:assert/strict";
import test from "node:test";
import { buildKingdomSubjectContext } from "../../../subjectContext";
import { buildLessonQuizPrompt } from "./lessonQuizPrompt";
import { buildBusinessStudiesKingdomPrompt } from "./promptBuilder";
import { buildReadingGenerationPrompt } from "./readingGenerationPrompt";
import { buildReadingStructurePrompt } from "./readingStructurePrompt";

const authorContext = buildKingdomSubjectContext({
  subjectKey: "business-studies",
  role: "Author",
  taskType: "Generate teaching content",
  stageOrGrade: "Cambridge IGCSE",
});

test("reading generation keeps its structured output contract", () => {
  const prompt = buildReadingGenerationPrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    learnerLevel: "Cambridge IGCSE",
    instruction: "Explain land, labour, capital and enterprise.",
  });

  assert.match(prompt, /SUBJECT CONTEXT/);
  assert.match(prompt, /Business Studies/);
  assert.match(prompt, /Cambridge IGCSE/);
  assert.match(prompt, /ad-astra-structured-reading/);
  assert.match(prompt, /Explain land, labour, capital and enterprise/);
  assert.match(prompt, /Do not force every available block type/);
});

test("reading structure stays formatting-only and preserves order", () => {
  const formattingPrompt = buildReadingStructurePrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    teacherContent: "Land and labour are inputs.",
    mode: "formatting_only",
  });

  assert.match(formattingPrompt, /FORMAT-ONLY MODE/);
  assert.match(formattingPrompt, /Preserve exact section order/);
  assert.match(formattingPrompt, /Do not summarise/);
  assert.match(formattingPrompt, /Do not shorten/);
  assert.match(formattingPrompt, /Do not paraphrase/);
  assert.match(formattingPrompt, /Do not improve wording/);
  assert.match(formattingPrompt, /Do not improve flow/);
  assert.match(formattingPrompt, /Do not move sections/);
  assert.match(formattingPrompt, /Do not merge sections/);
  assert.match(formattingPrompt, /ad-astra-structured-reading/);
  assert.doesNotMatch(formattingPrompt, /Improve grammar, clarity, flow/);
});

test("lesson quiz generation keeps the exact five-question multiple-choice retrieval contract", () => {
  const prompt = buildLessonQuizPrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    readingText: "Inputs include land, labour, capital and enterprise.",
  });

  assert.match(prompt, /exactly 5 multiple-choice reading-retrieval questions/i);
  assert.match(prompt, /This is NOT a Cambridge exam/);
  assert.match(prompt, /This is only a reading-engagement check/);
  assert.match(prompt, /Exactly one option must be unquestionably correct/);
  assert.match(prompt, /"optionA": "\.\.\."/);
  assert.match(prompt, /"optionD": "\.\.\."/);
  assert.match(prompt, /"correctOption": "A"/);
});

test("activity generation preserves question plans and output IDs", () => {
  const prompt = buildBusinessStudiesKingdomPrompt({
    subjectContext: authorContext,
    lessonTitle: "Business Inputs",
    lessonReading: "Inputs include land, labour, capital and enterprise.",
    activityTitle: "Operations Activity",
    questions: [
      {
        id: 1,
        paper: "paper-1",
        questionType: "define",
        marks: "2",
        ao: "AO1",
        guidance: "Give a precise meaning.",
      },
    ],
  });

  assert.match(prompt, /Operations Activity/);
  assert.match(prompt, /"assessmentObjectives": "AO1"/);
  assert.match(prompt, /returned id must match/i);
  assert.match(prompt, /Do not include answers/);
});




