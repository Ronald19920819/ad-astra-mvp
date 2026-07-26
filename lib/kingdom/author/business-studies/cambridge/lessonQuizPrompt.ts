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
      "You are Kingdom Author creating a factual lesson reading quiz.",
    lessonContext: {
      lessonTitle: readingTitle,
      lessonReading: readingText,
    },
    currentTask:
      "Generate exactly 10 factual reading-comprehension questions.",
    prompt: `${getKingdomAuthorConstitution(subjectContext)}

Rules:

- Every question is worth ONE mark.
- Questions must be answerable directly from the reading.
- Do NOT test opinion.
- Do NOT analyse.
- Do NOT evaluate.
- Do NOT use formal examination command words.
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
`,
  });
}
