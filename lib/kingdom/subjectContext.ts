import {
  getSubjectConfiguration,
  type SubjectKey,
} from "../subjects/subjectConfig";

export type KingdomRole = "Author" | "Tutor" | "Examiner" | "Analyst";

export type KingdomTeacherPreferenceValue =
  | string
  | number
  | boolean
  | readonly string[]
  | null;

export type KingdomTeacherPreferences = Readonly<
  Record<string, KingdomTeacherPreferenceValue>
>;

export type KingdomSubjectContext = {
  subjectKey: SubjectKey;
  subject: string;
  framework: string;
  stageOrGrade: string;
  role: KingdomRole;
  taskType: string;
  assessmentStyle: string;
  questionConventions: readonly string[];
  readingConventions: readonly string[];
  teacherPreferences: KingdomTeacherPreferences;
};

export function buildKingdomSubjectContext({
  subjectKey,
  role,
  taskType,
  stageOrGrade,
  teacherPreferences,
}: {
  subjectKey: SubjectKey;
  role: KingdomRole;
  taskType: string;
  stageOrGrade?: string | null;
  teacherPreferences?: KingdomTeacherPreferences;
}): KingdomSubjectContext {
  const subject = getSubjectConfiguration(subjectKey);

  return {
    subjectKey,
    subject: subject.displayName,
    framework: subject.framework,
    stageOrGrade:
      stageOrGrade?.trim() || subject.defaultStageOrGrade,
    role,
    taskType,
    assessmentStyle: subject.assessmentStyle,
    questionConventions: subject.questionConventions,
    readingConventions: subject.readingConventions,
    teacherPreferences: {
      ...subject.teacherPreferences,
      ...teacherPreferences,
    },
  };
}

export function serialiseKingdomSubjectContext(
  context: KingdomSubjectContext,
) {
  return JSON.stringify(
    {
      subjectKey: context.subjectKey,
      subject: context.subject,
      framework: context.framework,
      stageOrGrade: context.stageOrGrade,
      role: context.role,
      taskType: context.taskType,
      assessmentStyle: context.assessmentStyle,
      questionConventions: context.questionConventions,
      readingConventions: context.readingConventions,
    },
    null,
    2,
  );
}
