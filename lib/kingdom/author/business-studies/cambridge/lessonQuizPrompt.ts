import { buildKingdomPromptPipeline } from "../../../promptPipeline";
import {
  buildLessonQuizSubjectContext,
  type KingdomSubjectContext,
} from "../../../subjectContext";

type BuildLessonQuizPromptArgs = {
  subjectContext: KingdomSubjectContext;
  readingTitle: string;
  readingText: string;
};

const lessonQuizConstitution = `
LESSON READING QUIZ RULES

1. This is a simple reading-engagement and factual-retrieval quiz.
2. This is NOT a Cambridge exam.
3. This is NOT a formal assessment activity.
4. This is NOT an assessment-objective task.
5. Generate exactly 5 questions.
6. Each question is worth 1 mark.
7. Total quiz value is 5 marks.
8. Every correct answer must be explicitly supported by the supplied lesson reading.
9. Each question must test one clearly retrievable fact or idea.
10. Use short, natural factual question forms such as What is, Which of these, Who, Where, When, Which statement, What does X mean, or Which example.
11. Do NOT use Cambridge assessment command words or formal exam structures such as Explain, Analyse, Evaluate, Discuss, Justify, Recommend and justify, Consider and justify, Explain two or Outline two.
12. Do NOT ask for two characteristics, two reasons, multiple examples, developed explanation, application, analysis or evaluation.
13. Do NOT create trick questions.
14. Avoid synonyms where more than one option could become defensible.
15. Keep every question short.
16. Use exactly four options: A, B, C and D.
17. Exactly one option must be unquestionably correct.
18. The correctOption value must match the actual correct answer for that specific question.
19. Do NOT reuse the same correctOption for all 5 questions.
20. Vary the position of the correct answer naturally across A, B, C and D where factual accuracy allows.
`;

export function buildLessonQuizPrompt({
  subjectContext,
  readingTitle,
  readingText,
}: BuildLessonQuizPromptArgs) {
  const lessonQuizSubjectContext = buildLessonQuizSubjectContext(subjectContext);

  return buildKingdomPromptPipeline({
    subjectContext: lessonQuizSubjectContext,
    roleInstruction:
      "You are Kingdom Author creating a simple lesson reading-engagement multiple-choice quiz.",
    lessonContext: {
      lessonTitle: readingTitle,
      lessonReading: readingText,
    },
    currentTask:
      "Generate exactly 5 multiple-choice reading-retrieval questions with one clearly correct option each.",
    prompt: `${lessonQuizConstitution}

Return valid JSON only using this exact structure:

{
  "questions": [
    {
      "questionId": "q1",
      "questionText": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "B"
    },
    {
      "questionId": "q2",
      "questionText": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "D"
    }
  ]
}

Requirements:

- Exactly 5 questions.
- Every question must include all four options.
- Do not include numbering in the question text.
- Do not include markdown.
- Do not include explanations.
- Do not include more than one correct answer.
`,
  });
}