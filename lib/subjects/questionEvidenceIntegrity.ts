import {
  classifyReadingSourceMaterial,
  hasSufficientEvidenceForQuestion,
  isLanguageSubjectKey,
  questionRequiresSourceEvidence,
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

// Lesson quizzes have no paper/questionType presets (unlike activities), so
// there is no per-question evidenceRequirement map to build from. These
// helpers apply the same "never invent evidence" principle generically to a
// plain 5-question multiple-choice quiz.

const QUIZ_GENERIC_SOURCE_REFERENCE_PATTERN =
  /\b(from the extract|from the source|from the passage|according to the (?:source|extract|text|passage)|use evidence from|quote|quotation|quoted|which phrase|which words?)\b/i;
const QUIZ_SOURCE_LABEL_REFERENCE_PATTERN = /\bsource\s+[a-z0-9]\b/i;
const QUIZ_VISUAL_REFERENCE_PATTERN =
  /\b(the graph|the table|the map|the cartoon|the photograph|the photo|the image|the diagram|the chart|the statistics)\b/i;
const QUIZ_CASE_STUDY_REFERENCE_PATTERN =
  /\b(case study|the scenario|the business profile)\b/i;

export type QuizQuestionForIntegrity = {
  id: number;
  questionText: string;
};

export type QuizIntegrityIssue = {
  questionId: number;
  reason: string;
};

export function buildQuizEvidenceIntegrityPrompt(args: {
  subjectKey: SubjectKey;
  readingSourceType: "pasted_text" | "pdf";
  readingContent?: string | null;
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

  return `
UNIVERSAL EVIDENCE INTEGRITY (QUIZ)

- Generate every quiz question only from the supplied learner-visible lesson reading.
- Every correct answer must be explicitly supported by the reading.
- Every distractor must remain plausible but must never depend on an invented fact.
- Never claim a source, extract, quotation, image, map, cartoon, photograph, graph, table or case study exists unless it genuinely exists in the supplied reading.
- Never ask learners to quote, identify examples from an extract, or use evidence from a source unless that evidence is genuinely available in the supplied reading.
- If the reading does not support a particular kind of question, choose a different, ordinary knowledge or comprehension question instead of inventing evidence.
- If the reading is an attached PDF, inspect the actual PDF pages before deciding what is genuinely present.
- Ordinary questions about taught content are still allowed and do not need a special source, as long as the reading actually teaches the answer.

${readingSummary}
`;
}

export function validateQuizQuestionsAgainstTextReading(args: {
  subjectKey: SubjectKey;
  readingContent: string;
  questions: QuizQuestionForIntegrity[];
}) {
  const summary = summarizeTextReadingEvidence(args.subjectKey, args.readingContent);
  const issues: QuizIntegrityIssue[] = [];

  for (const question of args.questions) {
    const questionText = question.questionText.trim();
    if (!questionText) continue;

    if (isLanguageSubjectKey(args.subjectKey)) {
      const sufficiency = hasSufficientEvidenceForQuestion({
        subjectKey: args.subjectKey,
        questionText,
        readingContent: args.readingContent,
      });

      if (!sufficiency.ok) {
        issues.push({
          questionId: question.id,
          reason: `this question needs source/extract evidence the saved reading does not contain (${sufficiency.reason})`,
        });
      }

      continue;
    }

    if (
      QUIZ_SOURCE_LABEL_REFERENCE_PATTERN.test(questionText) &&
      summary.historySourceCount === 0
    ) {
      issues.push({
        questionId: question.id,
        reason:
          "the question refers to a labelled source that does not exist in the saved reading",
      });
      continue;
    }

    if (
      QUIZ_VISUAL_REFERENCE_PATTERN.test(questionText) &&
      summary.visualSourceCount === 0
    ) {
      issues.push({
        questionId: question.id,
        reason:
          "the question refers to a visual source (graph, table, map, cartoon, photograph, image, diagram or statistics) that does not exist in the saved reading",
      });
      continue;
    }

    if (
      QUIZ_CASE_STUDY_REFERENCE_PATTERN.test(questionText) &&
      summary.businessContextSignalCount === 0
    ) {
      issues.push({
        questionId: question.id,
        reason:
          "the question refers to a case study or business scenario that does not exist in the saved reading",
      });
      continue;
    }

    if (
      QUIZ_GENERIC_SOURCE_REFERENCE_PATTERN.test(questionText) &&
      summary.historySourceCount === 0
    ) {
      issues.push({
        questionId: question.id,
        reason:
          "the question refers to an extract, source or quotation that does not exist in the saved reading",
      });
    }
  }

  return { summary, issues };
}

// --- Independent PDF verification (Task 2C.3) ---
//
// For PDF readings there is no deterministic text classifier to check the
// generated question against (the evidence may be purely visual). Instead,
// a SECOND, independent model call inspects the same PDF the learner will
// receive and confirms whether the specific generated question is actually
// supported. This is only worth the extra OpenAI call for questions that
// plausibly depend on specific evidence — ordinary knowledge/recall
// questions never trigger it.

export type PdfVerificationQuestionInput = {
  id: number;
  questionText: string;
  requirementLabel?: string | null;
};

/**
 * Wording-only "does this question CLAIM special evidence" check, usable
 * without any reading content (unlike hasSufficientEvidenceForQuestion,
 * which needs the actual reading to judge sufficiency). Used to decide
 * whether a PDF-backed quiz question needs independent verification, since
 * quizzes have no per-question evidenceRequirement metadata to key off.
 */
export function quizQuestionClaimsSpecialEvidence(
  subjectKey: SubjectKey,
  questionText: string,
): boolean {
  const text = questionText.trim();
  if (!text) return false;

  if (
    isLanguageSubjectKey(subjectKey) &&
    questionRequiresSourceEvidence({ subjectKey, questionText: text })
  ) {
    return true;
  }

  return (
    QUIZ_SOURCE_LABEL_REFERENCE_PATTERN.test(text) ||
    QUIZ_VISUAL_REFERENCE_PATTERN.test(text) ||
    QUIZ_CASE_STUDY_REFERENCE_PATTERN.test(text) ||
    QUIZ_GENERIC_SOURCE_REFERENCE_PATTERN.test(text)
  );
}

/** Mirrors the activity route's pickPdfDetail strategy for the verification call: only ask for high-fidelity PDF rendering when a candidate question actually claims visual evidence. */
export function pickPdfVerificationDetail(
  questions: Array<{ questionText: string }>,
): "auto" | "high" {
  return questions.some((question) =>
    QUIZ_VISUAL_REFERENCE_PATTERN.test(question.questionText),
  )
    ? "high"
    : "auto";
}

export function buildPdfQuestionVerificationPrompt(args: {
  subjectKey: SubjectKey;
  questions: PdfVerificationQuestionInput[];
}) {
  const questionList = args.questions
    .map((question) => {
      const requirement = question.requirementLabel
        ? ` (requires: ${question.requirementLabel})`
        : "";
      return `- Question ${question.id}: "${question.questionText}"${requirement}`;
    })
    .join("\n");

  return `
INDEPENDENT PDF EVIDENCE VERIFICATION

You are verifying, not generating. Do not answer, rewrite or improve any question below.

For each question, determine whether it is fully answerable using only the attached PDF.
Check that every source, extract, map, cartoon, image, photograph, table, graph, statistics, case study, quotation, comparison target, or named factual detail referenced by the question actually exists and is sufficiently available in the attached PDF.
If a question requires comparing two sources, confirm at least two genuinely usable, distinct sources exist in the PDF.
Do not infer or assume material that is not actually present in the PDF.

Questions to verify:
${questionList}

Return valid JSON only using this exact structure:
{
  "results": [
    { "questionId": 1, "supported": true, "reason": "Brief reason." }
  ]
}

Return exactly one result for every question listed above, using the same question id.
Do not include markdown. Do not include explanations outside the JSON.
`;
}
