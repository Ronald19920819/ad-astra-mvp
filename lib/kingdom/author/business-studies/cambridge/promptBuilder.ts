import { businessStudiesKingdomConstitution } from "./constitution";

type KingdomQuestionPlan = {
  id: number;
  paper: string;
  questionType: string;
  marks: string;
  ao: string;
  guidance: string;
  questionText?: string;
};

type BuildBusinessStudiesPromptArgs = {
  lessonTitle: string;
  lessonReading: string;
  activityTitle?: string;
  questions: KingdomQuestionPlan[];
};

export function buildBusinessStudiesKingdomPrompt({
  lessonTitle,
  lessonReading,
  activityTitle,
  questions,
}: BuildBusinessStudiesPromptArgs) {
  const questionPlans = questions.map((question, index) => ({
    position: index + 1,
    id: question.id,
    paper: question.paper,
    questionType: question.questionType,
    marks: question.marks,
    assessmentObjectives: question.ao,
    guidance: question.guidance,
  }));

  return `
${businessStudiesKingdomConstitution}

ACTIVITY DETAILS

Lesson title:
${lessonTitle}

Activity title:
${activityTitle || "Untitled Activity"}

LESSON READING

${lessonReading}

QUESTION PLANS

${JSON.stringify(questionPlans, null, 2)}

FINAL INSTRUCTION

Generate one examination-style question for each question plan.

Return valid JSON only in this exact structure:

{
  "questions": [
    {
      "id": 1,
      "questionText": "Generated question here"
    }
  ]
}

The returned id must match the id supplied in each question plan.
Do not include markdown.
Do not include explanations.
Do not include answers.
`;
}