import assert from "node:assert/strict";
import test from "node:test";
import type {
  LessonQuizMarkingQuestion,
} from "./businessStudiesLessonQuiz";
import type { KingdomSubjectContext } from "../subjectContext";
import {
  buildBusinessStudiesLessonQuizMarkingPrompt,
  parseBusinessStudiesLessonQuizMarking,
} from "./businessStudiesLessonQuiz";

const reading =
  "Inputs include land, labour, capital and enterprise. Labour means the workers who contribute their effort. Capital includes machinery and equipment.";
const subjectContext = {
  subjectKey: "business-studies",
  subject: "Business Studies",
  framework: "Cambridge IGCSE",
  stageOrGrade: "Cambridge IGCSE",
  role: "Examiner",
  taskType: "Mark lesson reading quiz",
  assessmentStyle: "Business Studies assessment-objective based",
  questionConventions: ["Use Cambridge Business Studies command words."],
  readingConventions: ["Use clear textbook-style explanations."],
  teacherPreferences: {
    useCambridgeCommandWords: true,
  },
} satisfies KingdomSubjectContext;

function question(
  learnerAnswer: string,
  overrides: Partial<LessonQuizMarkingQuestion> = {},
): LessonQuizMarkingQuestion {
  return {
    questionId: "question-1",
    questionText: "Identify one input used in business operations.",
    learnerAnswer,
    expectedAnswer: "Land is one input used in business operations.",
    maximumMark: 1,
    assessmentObjective: "AO1",
    questionType: "identify",
    ...overrides,
  };
}

test("prompt supplies the reading and permits supported equivalent inputs", () => {
  const prompt = buildBusinessStudiesLessonQuizMarkingPrompt({
    subjectContext,
    lessonReading: reading,
    questions: [
      question("Labour"),
      question("Labor", { questionId: "question-2" }),
      question("Workers", { questionId: "question-3" }),
      question("Capital", { questionId: "question-4" }),
      question("Machinery", { questionId: "question-5" }),
    ],
  });

  assert.match(prompt, /Inputs include land, labour, capital and enterprise/);
  assert.match(prompt, /expected answer as a marking guide/i);
  assert.match(prompt, /British and American spelling variants/i);
  assert.match(prompt, /one-mark identification or example question/i);
  for (const answer of ["Labour", "Labor", "Workers", "Capital", "Machinery"]) {
    assert.match(prompt, new RegExp(answer));
  }
});

test("parser preserves correct alternative-answer feedback", () => {
  const questions = [question("Labour")];
  const [result] = parseBusinessStudiesLessonQuizMarking(
    JSON.stringify({
      results: [
        {
          questionId: "question-1",
          correct: true,
          mark: 1,
          feedback:
            "Correct. Labour is a valid input used in business operations.",
        },
      ],
    }),
    questions,
  );

  assert.equal(result.correct, true);
  assert.equal(result.mark, 1);
  assert.match(result.feedback, /Labour is a valid input/);
});

test("parser preserves rejection of an unrelated answer", () => {
  const questions = [question("Advertising")];
  const [result] = parseBusinessStudiesLessonQuizMarking(
    JSON.stringify({
      results: [
        {
          questionId: "question-1",
          correct: false,
          mark: 0,
          feedback:
            "Review which resources are transformed during operations.",
        },
      ],
    }),
    questions,
  );

  assert.equal(result.correct, false);
  assert.equal(result.mark, 0);
});

test("multi-mark explanations can receive partial but not full marks", () => {
  const questions = [
    question("Workers.", {
      questionText: "Explain how labour contributes to business operations.",
      expectedAnswer:
        "Workers apply effort and skills to transform inputs into outputs.",
      maximumMark: 2,
      questionType: "explain",
    }),
  ];
  const prompt = buildBusinessStudiesLessonQuizMarkingPrompt({
    subjectContext,
    lessonReading: reading,
    questions,
  });
  assert.match(prompt, /do not award full marks for an undeveloped/i);

  const [result] = parseBusinessStudiesLessonQuizMarking(
    JSON.stringify({
      results: [
        {
          questionId: "question-1",
          correct: false,
          mark: 1,
          feedback: "Identify how workers contribute to the transformation.",
        },
      ],
    }),
    questions,
  );

  assert.equal(result.correct, false);
  assert.equal(result.mark, 1);
});
