import type { SubjectKey } from "./subjectConfig";
import {
  classifyReadingSourceMaterial,
  hasSufficientEvidenceForQuestion,
  isLanguageSubjectKey,
  questionRequiresSourceEvidence,
} from "./languageSourceIntegrity";

export type LanguageAuditStatus = "OK" | "WARNING" | "FAIL";

export type LanguageAuditQuestionInput = {
  subjectKey: SubjectKey;
  questionId: string;
  questionIndex: number;
  questionText: string;
  questionType?: string | null;
  guidance?: string | null;
  readingContent: string;
};

export type LanguageAuditQuestionResult = {
  questionId: string;
  questionIndex: number;
  questionText: string;
  requiresSourceEvidence: boolean;
  sourceClassification: ReturnType<typeof classifyReadingSourceMaterial>["overallKind"];
  integrityStatus: LanguageAuditStatus;
  reason: string;
};

export type LanguageAuditActivityInput = {
  subjectKey: SubjectKey;
  subjectLabel: string;
  stageLabel: string;
  lessonId: string;
  lessonTitle: string;
  activityId: string;
  activityTitle: string;
  readingContent: string;
  questions: Omit<LanguageAuditQuestionInput, "subjectKey" | "readingContent">[];
};

export type LanguageAuditActivityResult = {
  subjectKey: SubjectKey;
  subjectLabel: string;
  stageLabel: string;
  lessonId: string;
  lessonTitle: string;
  activityId: string;
  activityTitle: string;
  readingClassification: ReturnType<typeof classifyReadingSourceMaterial>;
  integrityStatus: LanguageAuditStatus;
  questions: LanguageAuditQuestionResult[];
};

export type LanguageAuditSummary = {
  totalActivitiesScanned: number;
  totalQuestionsScanned: number;
  totalOk: number;
  totalWarning: number;
  totalFail: number;
  bySubject: Record<string, { OK: number; WARNING: number; FAIL: number }>;
};

function deriveRequiredEvidenceCount(questionText: string) {
  return /\b(two|2|twee)\b/i.test(questionText) ? 2 : 1;
}

function isComparisonQuestion(questionText: string) {
  return /\b(compare (?:the )?two texts?|compare the writers'? perspectives?)\b/i.test(questionText) ||
    /\b(vergelyk die tekste|vergelyk die twee tekste)\b/i.test(questionText);
}

export function auditLanguageQuestion(
  input: LanguageAuditQuestionInput,
): LanguageAuditQuestionResult {
  const requiresSourceEvidence = questionRequiresSourceEvidence({
    subjectKey: input.subjectKey,
    questionText: input.questionText,
    questionType: input.questionType,
    guidance: input.guidance,
  });
  const sufficiency = hasSufficientEvidenceForQuestion({
    subjectKey: input.subjectKey,
    questionText: input.questionText,
    questionType: input.questionType,
    guidance: input.guidance,
    readingContent: input.readingContent,
  });

  if (!requiresSourceEvidence) {
    return {
      questionId: input.questionId,
      questionIndex: input.questionIndex,
      questionText: input.questionText,
      requiresSourceEvidence: false,
      sourceClassification: sufficiency.classification.overallKind,
      integrityStatus: "OK",
      reason: "Question does not require source evidence.",
    };
  }

  if (!sufficiency.ok) {
    const reasonMap: Record<Exclude<typeof sufficiency.reason, "not_required" | "sufficient">, string> = {
      no_substantial_source:
        "Question requires source evidence, but the linked reading has no substantial learner-facing source material.",
      insufficient_examples:
        "Question requires more examples or evidence than the linked reading can support.",
      missing_second_text:
        "Question requires comparison between two texts, but the linked reading does not contain two substantial texts.",
      insufficient_structure:
        "Question requires structural judgement that the linked reading is too limited to support.",
      insufficient_quoted_material:
        "Question requires quotable material that the linked reading cannot adequately provide.",
    };
    const mappedReason =
      sufficiency.reason in reasonMap
        ? reasonMap[sufficiency.reason as keyof typeof reasonMap]
        : "Question requires source evidence that the linked reading cannot adequately support.";

    return {
      questionId: input.questionId,
      questionIndex: input.questionIndex,
      questionText: input.questionText,
      requiresSourceEvidence: true,
      sourceClassification: sufficiency.classification.overallKind,
      integrityStatus: "FAIL",
      reason: mappedReason,
    };
  }

  const requiredEvidenceCount = deriveRequiredEvidenceCount(input.questionText);
  const totalEvidence = sufficiency.classification.totalCandidateEvidenceCount;
  const comparisonQuestion = isComparisonQuestion(input.questionText);
  const warning = comparisonQuestion
    ? sufficiency.classification.substantialSourceCount === 2
    : totalEvidence <= requiredEvidenceCount + 1;

  return {
    questionId: input.questionId,
    questionIndex: input.questionIndex,
    questionText: input.questionText,
    requiresSourceEvidence: true,
    sourceClassification: sufficiency.classification.overallKind,
    integrityStatus: warning ? "WARNING" : "OK",
    reason: warning
      ? "Question is supported, but the linked reading provides only marginal spare evidence beyond the requested demand."
      : "Source-dependent question is adequately supported by the linked reading.",
  };
}

export function auditLanguageActivity(
  input: LanguageAuditActivityInput,
): LanguageAuditActivityResult {
  if (!isLanguageSubjectKey(input.subjectKey)) {
    throw new Error(`Unsupported subject key for language audit: ${input.subjectKey}`);
  }

  const readingClassification = classifyReadingSourceMaterial(
    input.readingContent,
    input.subjectKey,
  );
  const questions = input.questions.map((question) =>
    auditLanguageQuestion({
      subjectKey: input.subjectKey,
      readingContent: input.readingContent,
      ...question,
    }),
  );

  const integrityStatus = questions.some((question) => question.integrityStatus === "FAIL")
    ? "FAIL"
    : questions.some((question) => question.integrityStatus === "WARNING")
      ? "WARNING"
      : "OK";

  return {
    subjectKey: input.subjectKey,
    subjectLabel: input.subjectLabel,
    stageLabel: input.stageLabel,
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    activityId: input.activityId,
    activityTitle: input.activityTitle,
    readingClassification,
    integrityStatus,
    questions,
  };
}

export function summarizeLanguageAudit(
  results: LanguageAuditActivityResult[],
): LanguageAuditSummary {
  const summary: LanguageAuditSummary = {
    totalActivitiesScanned: results.length,
    totalQuestionsScanned: 0,
    totalOk: 0,
    totalWarning: 0,
    totalFail: 0,
    bySubject: {},
  };

  for (const result of results) {
    summary.totalQuestionsScanned += result.questions.length;
    if (!summary.bySubject[result.subjectLabel]) {
      summary.bySubject[result.subjectLabel] = { OK: 0, WARNING: 0, FAIL: 0 };
    }

    summary.bySubject[result.subjectLabel][result.integrityStatus] += 1;

    if (result.integrityStatus === "OK") summary.totalOk += 1;
    if (result.integrityStatus === "WARNING") summary.totalWarning += 1;
    if (result.integrityStatus === "FAIL") summary.totalFail += 1;
  }

  return summary;
}
