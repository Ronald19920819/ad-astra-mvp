import { getKingdomAuthorConstitution } from "./constitution";
import { buildKingdomPromptPipeline } from "../../../promptPipeline";
import type { KingdomSubjectContext } from "../../../subjectContext";

type BuildLessonQuizPromptArgs = {
  subjectContext: KingdomSubjectContext;
  readingTitle: string;
  readingText: string;
};

export function buildLessonQuizPrompt({
  subjectContext,
  readingTitle,
  readingText,
}: BuildLessonQuizPromptArgs) {
  return buildKingdomPromptPipeline({
    subjectContext,
    roleInstruction:
      "You are Kingdom Author creating a simple lesson reading-engagement multiple-choice quiz.",
    lessonContext: {
      lessonTitle: readingTitle,
      lessonReading: readingText,
    },
    currentTask:
      "Generate exactly 5 multiple-choice reading-retrieval questions with one clearly correct option each.",
    prompt: `${getKingdomAuthorConstitution(subjectContext)}

Rules:

- This is NOT a Cambridge exam.
- This is NOT a formal assessment.
- This is only a reading-engagement check.
- Every correct answer must be explicitly supported by the reading.
- Do NOT ask for analysis, evaluation, interpretation, inference, opinion or judgement.
- Do NOT use command words such as Explain, Analyse, Evaluate, Discuss or Justify.
- Do NOT use formal examination command words.
- Do NOT create trick questions.
- Do NOT ask for two reasons, two characteristics, multiple examples or any other multi-part answer.
- Avoid synonyms where more than one option could become defensible.
- Keep every question short.
- Use exactly four short options: A, B, C and D.
- Exactly one option must be unquestionably correct.
- The correctOption value must match the actual correct answer for that specific question.
- Do NOT reuse the same correctOption for all 5 questions.
- Vary the position of the correct answer naturally across A, B, C and D where factual accuracy allows.
- Every question is worth ONE mark.

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
