export const LESSON_QUIZ_OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export type LessonQuizOptionLetter =
  (typeof LESSON_QUIZ_OPTION_LETTERS)[number];

export type LessonQuizOptionMap = Record<LessonQuizOptionLetter, string>;

export type StoredLessonQuizQuestion = {
  id: string;
  questionText: string;
  marks: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: LessonQuizOptionLetter;
};

export function isLessonQuizOptionLetter(
  value: unknown,
): value is LessonQuizOptionLetter {
  return typeof value === "string" &&
    LESSON_QUIZ_OPTION_LETTERS.includes(value as LessonQuizOptionLetter);
}

export function buildLessonQuizOptionMap(question: {
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}): LessonQuizOptionMap {
  return {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };
}

export function getLessonQuizCorrectAnswerText(question: {
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: LessonQuizOptionLetter;
}) {
  return buildLessonQuizOptionMap(question)[question.correctOption];
}

export function isCompleteLessonQuizQuestion(value: unknown): value is {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: LessonQuizOptionLetter;
  marks: 1;
  questionId?: string;
} {
  if (!value || typeof value !== "object") return false;

  const question = value as Record<string, unknown>;
  return (
    typeof question.questionText === "string" &&
    question.questionText.trim().length > 0 &&
    typeof question.optionA === "string" &&
    question.optionA.trim().length > 0 &&
    typeof question.optionB === "string" &&
    question.optionB.trim().length > 0 &&
    typeof question.optionC === "string" &&
    question.optionC.trim().length > 0 &&
    typeof question.optionD === "string" &&
    question.optionD.trim().length > 0 &&
    isLessonQuizOptionLetter(question.correctOption) &&
    question.marks === 1
  );
}

export function scoreLessonQuizAnswers(
  questions: StoredLessonQuizQuestion[],
  submittedAnswers: Array<{ questionId: string; answer: LessonQuizOptionLetter }>,
) {
  const submittedAnswerMap = new Map(
    submittedAnswers.map((answer) => [answer.questionId, answer.answer]),
  );

  const results = questions.map((question) => {
    const learnerOption = submittedAnswerMap.get(question.id) ?? null;
    const correct = learnerOption === question.correctOption;

    return {
      questionId: question.id,
      correct,
      mark: correct ? question.marks : 0,
      feedback: correct
        ? "Correct."
        : "Not correct. Review the reading and try again.",
    };
  });

  const score = results.reduce((total, result) => total + result.mark, 0);
  const total = questions.reduce((sum, question) => sum + question.marks, 0);

  return { results, score, total };
}
