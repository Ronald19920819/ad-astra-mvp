export const ACTIVITY_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type ActivitySnapshotQuestion = {
  id: string;
  questionNumber: number;
  displayOrder: number;
  paper: string | null;
  questionType: string | null;
  questionText: string;
  marks: number;
  assessmentObjective: string | null;
  guidance: string | null;
};

export type ActivitySubmissionSnapshot = {
  schemaVersion: typeof ACTIVITY_SNAPSHOT_SCHEMA_VERSION;
  legacyBackfill: boolean;
  submittedAt: string;
  activity: {
    id: string;
    version: number;
    title: string;
    instructions: string | null;
    totalMarks: number;
    dueDate: string | null;
  };
  subject: {
    id: string;
    name: string;
  };
  lesson: {
    id: string;
    title: string;
    lessonNumber: string;
    termNumber: number | null;
    weekNumber: number | null;
  };
  reading: {
    id: string;
    title: string;
    contentText: string;
  };
  questions: ActivitySnapshotQuestion[];
};

type SnapshotSource = Omit<
  ActivitySubmissionSnapshot,
  "schemaVersion" | "legacyBackfill"
>;

export function createActivitySubmissionSnapshot(
  source: SnapshotSource,
): ActivitySubmissionSnapshot {
  return {
    schemaVersion: ACTIVITY_SNAPSHOT_SCHEMA_VERSION,
    legacyBackfill: false,
    submittedAt: source.submittedAt,
    activity: { ...source.activity },
    subject: { ...source.subject },
    lesson: { ...source.lesson },
    reading: { ...source.reading },
    questions: source.questions.map((question) => ({ ...question })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isSnapshotQuestion(value: unknown): value is ActivitySnapshotQuestion {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    Number.isInteger(value.questionNumber) &&
    Number.isInteger(value.displayOrder) &&
    isNullableString(value.paper) &&
    isNullableString(value.questionType) &&
    typeof value.questionText === "string" &&
    Number.isInteger(value.marks) &&
    Number(value.marks) > 0 &&
    isNullableString(value.assessmentObjective) &&
    isNullableString(value.guidance)
  );
}

export function isActivitySubmissionSnapshot(
  value: unknown,
): value is ActivitySubmissionSnapshot {
  if (!isRecord(value)) return false;
  const activity = value.activity;
  const subject = value.subject;
  const lesson = value.lesson;
  const reading = value.reading;

  return (
    value.schemaVersion === ACTIVITY_SNAPSHOT_SCHEMA_VERSION &&
    typeof value.legacyBackfill === "boolean" &&
    typeof value.submittedAt === "string" &&
    isRecord(activity) &&
    typeof activity.id === "string" &&
    Number.isInteger(activity.version) &&
    Number(activity.version) > 0 &&
    typeof activity.title === "string" &&
    isNullableString(activity.instructions) &&
    Number.isInteger(activity.totalMarks) &&
    Number(activity.totalMarks) > 0 &&
    isNullableString(activity.dueDate) &&
    isRecord(subject) &&
    typeof subject.id === "string" &&
    typeof subject.name === "string" &&
    isRecord(lesson) &&
    typeof lesson.id === "string" &&
    typeof lesson.title === "string" &&
    typeof lesson.lessonNumber === "string" &&
    isNullableNumber(lesson.termNumber) &&
    isNullableNumber(lesson.weekNumber) &&
    isRecord(reading) &&
    typeof reading.id === "string" &&
    typeof reading.title === "string" &&
    typeof reading.contentText === "string" &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.every(isSnapshotQuestion)
  );
}

export function snapshotQuestionById(
  snapshot: ActivitySubmissionSnapshot,
) {
  return new Map(
    snapshot.questions.map((question) => [question.id, question]),
  );
}

export function shouldWarnBeforeActivityEdit(submissionCount: number) {
  return Number.isInteger(submissionCount) && submissionCount > 0;
}
