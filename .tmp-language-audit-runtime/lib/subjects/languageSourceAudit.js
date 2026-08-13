"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLanguageQuestion = auditLanguageQuestion;
exports.auditLanguageActivity = auditLanguageActivity;
exports.summarizeLanguageAudit = summarizeLanguageAudit;
const languageSourceIntegrity_1 = require("./languageSourceIntegrity");
function deriveRequiredEvidenceCount(questionText) {
    return /\b(two|2|twee)\b/i.test(questionText) ? 2 : 1;
}
function isComparisonQuestion(questionText) {
    return /\b(compare (?:the )?two texts?|compare the writers'? perspectives?)\b/i.test(questionText) ||
        /\b(vergelyk die tekste|vergelyk die twee tekste)\b/i.test(questionText);
}
function auditLanguageQuestion(input) {
    const requiresSourceEvidence = (0, languageSourceIntegrity_1.questionRequiresSourceEvidence)({
        subjectKey: input.subjectKey,
        questionText: input.questionText,
        questionType: input.questionType,
        guidance: input.guidance,
    });
    const sufficiency = (0, languageSourceIntegrity_1.hasSufficientEvidenceForQuestion)({
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
        const reasonMap = {
            no_substantial_source: "Question requires source evidence, but the linked reading has no substantial learner-facing source material.",
            insufficient_examples: "Question requires more examples or evidence than the linked reading can support.",
            missing_second_text: "Question requires comparison between two texts, but the linked reading does not contain two substantial texts.",
            insufficient_structure: "Question requires structural judgement that the linked reading is too limited to support.",
            insufficient_quoted_material: "Question requires quotable material that the linked reading cannot adequately provide.",
        };
        const mappedReason = sufficiency.reason in reasonMap
            ? reasonMap[sufficiency.reason]
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
function auditLanguageActivity(input) {
    if (!(0, languageSourceIntegrity_1.isLanguageSubjectKey)(input.subjectKey)) {
        throw new Error(`Unsupported subject key for language audit: ${input.subjectKey}`);
    }
    const readingClassification = (0, languageSourceIntegrity_1.classifyReadingSourceMaterial)(input.readingContent, input.subjectKey);
    const questions = input.questions.map((question) => auditLanguageQuestion({
        subjectKey: input.subjectKey,
        readingContent: input.readingContent,
        ...question,
    }));
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
function summarizeLanguageAudit(results) {
    const summary = {
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
        if (result.integrityStatus === "OK")
            summary.totalOk += 1;
        if (result.integrityStatus === "WARNING")
            summary.totalWarning += 1;
        if (result.integrityStatus === "FAIL")
            summary.totalFail += 1;
    }
    return summary;
}
