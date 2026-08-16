import assert from "node:assert/strict";
import test from "node:test";
import { buildKingdomSubjectContext } from "../../../subjectContext";
import { buildLessonQuizPrompt } from "./lessonQuizPrompt";
import { buildBusinessStudiesKingdomPrompt } from "./promptBuilder";
import { buildReadingGenerationPrompt } from "./readingGenerationPrompt";
import { buildReadingStructurePrompt } from "./readingStructurePrompt";
import { buildQuizEvidenceIntegrityPrompt } from "../../../../subjects/questionEvidenceIntegrity";

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

test("lesson quiz generation strips Cambridge assessment instructions from the compiled text-reading prompt", () => {
  const readingText = "Inputs include land, labour, capital and enterprise.";
  const prompt = buildLessonQuizPrompt({
    subjectContext: authorContext,
    readingTitle: "Business Inputs",
    readingSourceType: "pasted_text",
    readingText,
    quizEvidenceIntegrityPrompt: buildQuizEvidenceIntegrityPrompt({
      subjectKey: "business-studies",
      readingSourceType: "pasted_text",
      readingContent: readingText,
    }),
  });

  assert.match(prompt, /exactly 5 multiple-choice reading-retrieval questions/i);
  assert.match(prompt, /This is NOT a Cambridge exam/);
  assert.match(prompt, /Exactly one option must be unquestionably correct/);
  assert.match(prompt, /"optionA": "\.\.\."/);
  assert.match(prompt, /"optionD": "\.\.\."/);
  assert.match(prompt, /"correctOption": "B"/);
  assert.match(prompt, /UNIVERSAL EVIDENCE INTEGRITY \(QUIZ\)/);
  assert.match(prompt, /Never claim a source, extract, quotation/i);
  assert.doesNotMatch(prompt, /Paper 1/i);
  assert.doesNotMatch(prompt, /Paper 2/i);
  assert.doesNotMatch(prompt, /Use Cambridge Business Studies command words\./i);
  assert.doesNotMatch(prompt, /Respect AO labels and mark allocations\./i);
  assert.doesNotMatch(prompt, /\bAO1\b|\bAO2\b|\bAO3\b|\bAO4\b/);
  assert.doesNotMatch(prompt, /assessment objectives/i);
});

test("lesson quiz prompt tells Kingdom to inspect the attached PDF when the saved reading is a PDF", () => {
  const prompt = buildLessonQuizPrompt({
    subjectContext: authorContext,
    readingTitle: "The Cold War Sources",
    readingSourceType: "pdf",
    quizEvidenceIntegrityPrompt: buildQuizEvidenceIntegrityPrompt({
      subjectKey: "history",
      readingSourceType: "pdf",
    }),
  });

  assert.match(prompt, /attached separately as a PDF file input/i);
  assert.match(prompt, /Inspect the attached PDF itself before drafting the quiz/i);
  assert.match(prompt, /Never invent facts/i);
  assert.match(prompt, /UNIVERSAL EVIDENCE INTEGRITY \(QUIZ\)/);
  assert.match(prompt, /inspect the actual PDF pages/i);
});

test("activity generation preserves question plans, output IDs and the integrity-check contract", () => {
  const prompt = buildBusinessStudiesKingdomPrompt({
    subjectContext: authorContext,
    lessonTitle: "Business Inputs",
    lessonReading: "Inputs include land, labour, capital and enterprise.",
    readingSourceType: "pasted_text",
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
    universalEvidenceIntegrityPrompt: "UNIVERSAL EVIDENCE INTEGRITY",
  });

  assert.match(prompt, /Operations Activity/);
  assert.match(prompt, /"assessmentObjectives": "AO1"/);
  assert.match(prompt, /Use Cambridge Business Studies command words\./);
  assert.match(prompt, /Respect AO labels and mark allocations\./);
  assert.match(prompt, /For Paper 1 questions, keep the wording focused and concise\./);
  assert.match(prompt, /For Paper 2 questions, use the case-study context and require applied reasoning where appropriate\./);
  assert.match(prompt, /returned id must match/i);
  assert.match(prompt, /Do not include answers/);
  assert.match(prompt, /"integrityCheck"/);
  assert.match(prompt, /UNIVERSAL EVIDENCE INTEGRITY/);
});
