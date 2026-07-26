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

test("reading structure keeps both teacher-controlled modes", () => {
  const formattingPrompt = buildReadingStructurePrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    teacherContent: "Land and labour are inputs.",
    mode: "formatting_only",
  });
  const languagePrompt = buildReadingStructurePrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    teacherContent: "Land and labour are inputs.",
    mode: "formatting_and_language",
  });

  assert.match(formattingPrompt, /Preserve the teacher's wording/);
  assert.match(languagePrompt, /Improve grammar, clarity, flow/);
  assert.match(formattingPrompt, /ad-astra-structured-reading/);
  assert.match(languagePrompt, /ad-astra-structured-reading/);
});

test("lesson quiz generation keeps the exact ten one-mark contract", () => {
  const prompt = buildLessonQuizPrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    readingText: "Inputs include land, labour, capital and enterprise.",
  });

  assert.match(prompt, /exactly 10 factual reading-comprehension questions/i);
  assert.match(prompt, /Every question is worth ONE mark/);
  assert.match(prompt, /Questions must be answerable directly from the reading/);
  assert.match(prompt, /"answerText": "\.\.\."/);
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
