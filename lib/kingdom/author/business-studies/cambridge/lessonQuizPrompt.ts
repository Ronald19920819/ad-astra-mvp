import { businessStudiesKingdomConstitution } from "./constitution";

type BuildLessonQuizPromptArgs = {
  readingTitle: string;
  readingText: string;
};

export function buildLessonQuizPrompt({
  readingTitle,
  readingText,
}: BuildLessonQuizPromptArgs) {
  return `
${businessStudiesKingdomConstitution}

LESSON DETAILS

Lesson title:
${readingTitle}

LESSON READING

${readingText}

FINAL INSTRUCTION

Generate EXACTLY 10 factual reading-comprehension questions.

Rules:

- Every question is worth ONE mark.
- Questions must be answerable directly from the reading.
- Do NOT test opinion.
- Do NOT analyse.
- Do NOT evaluate.
- Do NOT use Cambridge command words.
- Do NOT create examination questions.
- Questions should simply confirm that the learner has read the lesson.

Return valid JSON only using this exact structure:

{
  "questions": [
    {
      "questionText": "...",
      "answerText": "..."
    }
  ]
}

Requirements:

- Exactly 10 questions.
- Exactly 10 answers.
- Keep answers concise.
- Do not include numbering.
- Do not include markdown.
- Do not include explanations.
`;
}