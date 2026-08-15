import { getKingdomAuthorConstitution } from "./constitution";
import { buildKingdomPromptPipeline } from "../../../promptPipeline";
import type { KingdomSubjectContext } from "../../../subjectContext";
import { buildLanguageActivitySourceIntegrityPrompt } from "../../../../subjects/languageSourceIntegrity";

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
  subjectContext: KingdomSubjectContext;
  lessonTitle: string;
  lessonReading: string;
  readingSourceType: "pasted_text" | "pdf";
  activityTitle?: string;
  questions: KingdomQuestionPlan[];
  universalEvidenceIntegrityPrompt: string;
};

export function buildBusinessStudiesKingdomPrompt({
  subjectContext,
  lessonTitle,
  lessonReading,
  readingSourceType,
  activityTitle,
  questions,
  universalEvidenceIntegrityPrompt,
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
  const languageSourceIntegrityPrompt =
    readingSourceType === "pasted_text"
      ? buildLanguageActivitySourceIntegrityPrompt({
          subjectKey: subjectContext.subjectKey,
          lessonReading,
        })
      : "";
  const lessonContext =
    readingSourceType === "pdf"
      ? {
          lessonTitle,
          lessonReading:
            "Authoritative saved lesson reading is attached separately as a PDF file input.",
        }
      : {
          lessonTitle,
          lessonReading,
        };

  return buildKingdomPromptPipeline({
    subjectContext,
    roleInstruction:
      "You are Kingdom Author drafting examination-style activity questions for teacher review.",
    lessonContext,
    currentTask: {
      activityTitle: activityTitle || "Untitled Activity",
      questionPlans,
    },
    prompt: `${getKingdomAuthorConstitution(subjectContext)}${languageSourceIntegrityPrompt}
${universalEvidenceIntegrityPrompt}

Generate one examination-style question for each question plan.

Return valid JSON only in this exact structure:

{
  "questions": [
    {
      "id": 1,
      "questionText": "Generated question here",
      "integrityCheck": {
        "supported": true,
        "evidenceKinds": ["history-source"],
        "evidenceCount": 1,
        "notes": "Briefly state what in the lesson supports this question."
      }
    }
  ]
}

The returned id must match the id supplied in each question plan.
Do not include markdown.
Do not include explanations.
Do not include answers.
`,
  });
}
