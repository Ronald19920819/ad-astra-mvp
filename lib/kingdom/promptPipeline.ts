import {
  serialiseKingdomSubjectContext,
  type KingdomSubjectContext,
} from "./subjectContext";

type KingdomPromptPipelineInput = {
  subjectContext: KingdomSubjectContext;
  roleInstruction: string;
  lessonContext?: unknown;
  currentTask: unknown;
  prompt: string;
};

function serialiseSection(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function buildKingdomPromptPipeline({
  subjectContext,
  roleInstruction,
  lessonContext = "No lesson context supplied.",
  currentTask,
  prompt,
}: KingdomPromptPipelineInput) {
  return `
KINGDOM ROLE

${roleInstruction}

SUBJECT CONTEXT

${serialiseKingdomSubjectContext(subjectContext)}

LESSON CONTEXT

${serialiseSection(lessonContext)}

TEACHER PREFERENCES

${JSON.stringify(subjectContext.teacherPreferences, null, 2)}

CURRENT TASK

${serialiseSection(currentTask)}

PROMPT

${prompt}
`.trim();
}
