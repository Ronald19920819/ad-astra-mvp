export const LESSON_QUIZ_PASS_PERCENT = 80;

export function hasPassedLessonQuiz(score: number, total: number) {
  return (
    Number.isInteger(score) &&
    Number.isInteger(total) &&
    score >= 0 &&
    total > 0 &&
    score <= total &&
    score * 100 >= total * LESSON_QUIZ_PASS_PERCENT
  );
}
