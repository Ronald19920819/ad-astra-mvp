import {
  classifyReadingSourceMaterial,
  hasSufficientEvidenceForQuestion,
  isLanguageSubjectKey,
} from "./languageSourceIntegrity";
import {
  getQuestionEvidenceRequirement,
  type QuestionEvidenceRequirement,
} from "./questionPresets";
import type { SubjectKey } from "./subjectConfig";

const HISTORY_SOURCE_UNIT_PATTERN =
  /(?:^|\n)\s*(?:Heading|Subheading):\s*(source\s+[a-z0-9]+|cartoon|map|poster|photograph|photo|diagram|graph|table|statistics)\b/gim;
const VISUAL_SOURCE_PATTERN =
  /\b(cartoon|map|poster|photograph|photo|diagram|graph|table|statistics)\b/gi;
const BUSINESS_CONTEXT_PATTERN =
  /\b(case study|scenario|business profile|company profile|business background|business situation|context for the business)\b/gi;

export type QuestionPlanForIntegrity = {
  id: number;
  questionType: string;
  guidance?: string | null;
};

export type ReadingEvidenceSummary = {
  wordCount: number;
  historySourceCount: number;
  visualSourceCount: number;
  businessContextSignalCount: number;
  substantialSourceCount: number;
};

export type TextReadingRequirementIssue = {
  questionId: number;
  questionType: string;
  reason: string;
};

export type GeneratedQuestionIntegrityCheck = {
  supported?: boolean;
  evidenceKinds?: string[];
  evidenceCount?: number;
  notes?: string;
};

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function countHistorySourceUnits(value: string) {
  return Array.from(value.matchAll(HISTORY_SOURCE_UNIT_PATTERN)).length;
}

export function summarizeTextReadingEvidence(
  subjectKey: SubjectKey,
  readingContent: string,
): ReadingEvidenceSummary {
  const languageClassification = isLanguageSubjectKey(subjectKey)
    ? classifyReadingSourceMaterial(readingContent, subjectKey)
    : null;

  const normalizedText = readingContent.replace(/\s+/g, " ").trim();
  const wordCount = normalizedText ? normalizedText.split(" ").length : 0;

  return {
    wordCount,
    historySourceCount: countHistorySourceUnits(readingContent),
    visualSourceCount: countMatches(readingContent, VISUAL_SOURCE_PATTERN),
    businessContextSignalCount: countMatches(
      readingContent,
      BUSINESS_CONTEXT_PATTERN,
    ),
    substantialSourceCount:
      languageClassification?.substantialSourceCount ?? 0,
  };
}

function describeReadingEvidenceSummary(summary: ReadingEvidenceSummary) {
  return [
    `Detected text length: about ${summary.wordCount} words.`,
    `Detected source labels: ${summary.historySourceCount}.`,
    `Detected visual-source labels: ${summary.visualSourceCount}.`,
    `Detected business-context labels: ${summary.businessContextSignalCount}.`,
    `Detected substantial learner-facing text sources: ${summary.substantialSourceCount}.`,
  ].join(" ");
}

function checkRequirementAgainstTextSummary(args: {
  requirement: QuestionEvidenceRequirement;
  summary: ReadingEvidenceSummary;
}) {
  if (
    args.requirement.acceptedEvidenceKinds.includes("history-source") &&
    args.summary.historySourceCount < (args.requirement.minimumSourceCount ?? 1)
  ) {
    return `the saved reading does not contain ${args.requirement.teacherFacingLabel}`;
  }

  if (
    args.requirement.acceptedEvidenceKinds.includes("visual-source") &&
    args.requirement.visualAccessRequired === true &&
    args.summary.visualSourceCount === 0
  ) {
    return `the saved reading does not contain the required visual source material`;
  }

  if (
    args.requirement.acceptedEvidenceKinds.includes("business-context") &&
    args.requirement.contextualSupportRequired === true &&
    args.summary.wordCount < 80
  ) {
    return `the saved reading is too thin to ground a contextual business question safely`;
  }

  return null;
}

export function validateQuestionPlansAgainstTextReading(args: {
  subjectKey: SubjectKey;
  readingContent: string;
  questions: QuestionPlanForIntegrity[];
}) {
  const summary = summarizeTextReadingEvidence(args.subjectKey, args.readingContent);
  const issues: TextReadingRequirementIssue[] = [];

  for (const question of args.questions) {
    const requirement = getQuestionEvidenceRequirement(
      args.subjectKey,
      question.questionType,
    );
    if (!requirement) {
      continue;
    }

    if (
      requirement.acceptedEvidenceKinds.includes("substantial-text") &&
      summary.substantialSourceCount === 0
    ) {
      issues.push({
        questionId: question.id,
        questionType: question.questionType,
        reason: `the saved reading does not contain ${requirement.teacherFacingLabel}`,
      });
      continue;
    }

    const summaryIssue = checkRequirementAgainstTextSummary({
      requirement,
      summary,
    });

    if (summaryIssue) {
      issues.push({
        questionId: question.id,
        questionType: question.questionType,
        reason: summaryIssue,
      });
    }
  }

  return { summary, issues };
}

export function buildUniversalEvidenceIntegrityPrompt(args: {
  subjectKey: SubjectKey;
  readingSourceType: "pasted_text" | "pdf";
  readingContent?: string | null;
  questions: QuestionPlanForIntegrity[];
}) {
  const readingSummary =
    args.readingSourceType === "pdf"
      ? "Authoritative reading format: PDF. You can inspect both the written content and the visual page evidence in the attached PDF."
      : `Authoritative reading format: saved lesson text. ${describeReadingEvidenceSummary(
          summarizeTextReadingEvidence(
            args.subjectKey,
            args.readingContent ?? "",
          ),
        )}`;

  const questionRequirements = args.questions
    .map((question) => {
      const requirement = getQuestionEvidenceRequirement(
        args.subjectKey,
        question.questionType,
      );

      if (!requirement) {
        return `- Question ${question.id}: no special-source requirement. It still must be answerable from the supplied lesson reading.`;
      }

      return `- Question ${question.id}: requires ${requirement.teacherFacingLabel}. Accepted evidence kinds: ${requirement.acceptedEvidenceKinds.join(
        ", ",
      )}. Minimum source count: ${requirement.minimumSourceCount ?? 1}.`;
    })
    .join("\n");

  return `
UNIVERSAL EVIDENCE INTEGRITY

- Every generated question must be answerable from the authoritative saved lesson reading linked to this lesson.
- Never invent a source, extract, map, cartoon, photograph, statistics table, business scenario, quotation, or named fact that is not actually present in the supplied reading.
- If a question plan cannot be supported by the supplied reading, do not bluff. Mark it unsupported in the returned integrityCheck object instead of inventing evidence.
- If the reading is an attached PDF, inspect the actual PDF pages before deciding whether the evidence exists.
- If the reading is saved text only, stay within that text exactly.
- Questions that do not need a special source are still allowed, but they must remain grounded in the lesson reading.

${readingSummary}

Question requirement map:
${questionRequirements}

Return an integrityCheck object for every question using this exact shape:
"integrityCheck": {
  "supported": true,
  "evidenceKinds": ["history-source"],
  "evidenceCount": 2,
  "notes": "Briefly state what evidence in the lesson supports the generated question."
}

If a question plan is unsupported, set:
- "supported": false
- "questionText": ""
- "notes": a short teacher-facing reason
`;
}

export function validateGeneratedQuestionIntegrity(args: {
  subjectKey: SubjectKey;
  questionType: string;
  guidance?: string | null;
  questionText: string;
  readingSourceType: "pasted_text" | "pdf";
  readingContent?: string | null;
  integrityCheck?: GeneratedQuestionIntegrityCheck | null;
}) {
  const requirement = getQuestionEvidenceRequirement(
    args.subjectKey,
    args.questionType,
  );

  if (args.integrityCheck?.supported === false) {
    return {
      ok: false,
      reason:
        args.integrityCheck.notes?.trim() ||
        "the required lesson evidence is not available",
    };
  }

  if (requirement && args.integrityCheck?.supported !== true) {
    return {
      ok: false,
      reason: `Kingdom did not confirm that ${requirement.teacherFacingLabel} exists in the lesson reading.`,
    };
  }

  if (
    args.readingSourceType === "pasted_text" &&
    args.readingContent &&
    isLanguageSubjectKey(args.subjectKey)
  ) {
    const result = hasSufficientEvidenceForQuestion({
      subjectKey: args.subjectKey,
      questionText: args.questionText,
      questionType: args.questionType,
      guidance: args.guidance ?? null,
      readingContent: args.readingContent,
    });

    if (!result.ok) {
      return {
        ok: false,
        reason: `the saved text reading does not contain enough defensible evidence for this generated question (${result.reason})`,
      };
    }
  }

  return { ok: true, reason: null };
}
