import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLessonQuizOptionMap,
  scoreLessonQuizAnswers,
  type StoredLessonQuizQuestion,
} from "./lessonQuiz";

test("lesson quiz options map preserves A-D choices", () => {
  assert.deepEqual(
    buildLessonQuizOptionMap({
      optionA: "Red",
      optionB: "Green",
      optionC: "Blue",
      optionD: "Black",
    }),
    {
      A: "Red",
      B: "Green",
      C: "Blue",
      D: "Black",
    },
  );
});

test("lesson quiz scoring is deterministic from the stored correct option", () => {
  const questions: StoredLessonQuizQuestion[] = [
    {
      id: "q1",
      questionText: "What colour is Batman's suit?",
      marks: 1,
      optionA: "Red",
      optionB: "Green",
      optionC: "Yellow",
      optionD: "Black",
      correctOption: "D",
    },
    {
      id: "q2",
      questionText: "How many options does the learner see?",
      marks: 1,
      optionA: "Two",
      optionB: "Three",
      optionC: "Four",
      optionD: "Five",
      correctOption: "C",
    },
  ];

  const result = scoreLessonQuizAnswers(questions, [
    { questionId: "q1", answer: "D" },
    { questionId: "q2", answer: "B" },
  ]);

  assert.equal(result.score, 1);
  assert.equal(result.total, 2);
  assert.deepEqual(result.results, [
    {
      questionId: "q1",
      correct: true,
      mark: 1,
      feedback: "Correct.",
    },
    {
      questionId: "q2",
      correct: false,
      mark: 0,
      feedback: "Not correct. Review the reading and try again.",
    },
  ]);
});
