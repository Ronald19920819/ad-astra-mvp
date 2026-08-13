"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const languageSourceAudit_1 = require("./languageSourceAudit");
const teachingProseOnly = `
Heading: Understanding Narrative Structure

A non-linear narrative does not tell events in the order they happened.

Definition - Non-linear narrative: A story structure that moves backwards and forwards in time.

- Writers can create suspense by delaying key information.
- Narrative structure can shape the reader's understanding.

Example: The old castle burned as James watched everything disappear into the flames.
`;
const substantialEnglishExtract = `
Heading: Teaching Extract

James stepped into the corridor and heard the floorboards crack behind him. The candle flickered and the shadows stretched across the walls. He froze when a door creaked open upstairs. A cold gust swept through the house and the flame almost died. He wanted to call out, but the silence felt heavier than the darkness itself.

Heading: Let's Analyse It

One moment of suspense is created when the floorboards crack behind James. Another comes when the candle flickers and the shadows stretch.
`;
const substantialAfrikaansExtract = `
Heading: Uittreksel

Karla het stadig deur die donker gang geloop. Die wind het teen die vensters gefluit en die vloerplanke het onder haar voete gekraak. Skielik het 'n deur oopgeswaai en 'n koue trekwind het die kers byna doodgeblaas. Sy het haar asem opgehou toe sy 'n sagte fluistering agter haar hoor.

Heading: Wat die voorbeeld wys

Die gekraak en die fluistering bou spanning in die toneel.
`;
(0, node_test_1.default)("audit marks teaching prose plus quote request as FAIL", () => {
    const result = (0, languageSourceAudit_1.auditLanguageActivity)({
        subjectKey: "english",
        subjectLabel: "English 0861 - Stage 9",
        stageLabel: "Stage 9",
        lessonId: "lesson-1",
        lessonTitle: "Understanding Narrative Structure",
        activityId: "activity-1",
        activityTitle: "Narrative Analysis",
        readingContent: teachingProseOnly,
        questions: [
            {
                questionId: "q1",
                questionIndex: 1,
                questionText: "Quote two phrases from the extract that create suspense.",
                questionType: "language-analysis",
            },
        ],
    });
    strict_1.default.equal(result.integrityStatus, "FAIL");
    strict_1.default.equal(result.questions[0].integrityStatus, "FAIL");
});
(0, node_test_1.default)("audit marks substantial English extract plus valid evidence question as OK or WARNING, not FAIL", () => {
    const result = (0, languageSourceAudit_1.auditLanguageActivity)({
        subjectKey: "english-stage-8",
        subjectLabel: "English 0861 - Stage 8",
        stageLabel: "Stage 8",
        lessonId: "lesson-2",
        lessonTitle: "Suspense Techniques",
        activityId: "activity-2",
        activityTitle: "Suspense Analysis",
        readingContent: substantialEnglishExtract,
        questions: [
            {
                questionId: "q1",
                questionIndex: 1,
                questionText: "Identify two examples from the extract where the writer creates suspense.",
                questionType: "language-analysis",
            },
        ],
    });
    strict_1.default.notEqual(result.integrityStatus, "FAIL");
});
(0, node_test_1.default)("audit marks one text plus compare the two texts as FAIL", () => {
    const result = (0, languageSourceAudit_1.auditLanguageActivity)({
        subjectKey: "english",
        subjectLabel: "English 0861 - Stage 9",
        stageLabel: "Stage 9",
        lessonId: "lesson-3",
        lessonTitle: "Comparing Writers",
        activityId: "activity-3",
        activityTitle: "Comparison Task",
        readingContent: substantialEnglishExtract,
        questions: [
            {
                questionId: "q1",
                questionIndex: 1,
                questionText: "Compare the two texts and explain how the writers create tension.",
                questionType: "interpretation",
            },
        ],
    });
    strict_1.default.equal(result.integrityStatus, "FAIL");
    strict_1.default.match(result.questions[0].reason, /two substantial texts/i);
});
(0, node_test_1.default)("audit marks substantial Afrikaans extract plus valid haal aan question as OK or WARNING, not FAIL", () => {
    const result = (0, languageSourceAudit_1.auditLanguageActivity)({
        subjectKey: "afrikaans",
        subjectLabel: "Afrikaans - Stage 9",
        stageLabel: "Grade 9",
        lessonId: "lesson-4",
        lessonTitle: "Spanning in 'n verhaal",
        activityId: "activity-4",
        activityTitle: "Taal en Toon",
        readingContent: substantialAfrikaansExtract,
        questions: [
            {
                questionId: "q1",
                questionIndex: 1,
                questionText: "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
                questionType: "taal-en-toon",
            },
        ],
    });
    strict_1.default.notEqual(result.integrityStatus, "FAIL");
});
(0, node_test_1.default)("audit marks non-source-dependent knowledge question as OK", () => {
    const result = (0, languageSourceAudit_1.auditLanguageActivity)({
        subjectKey: "english",
        subjectLabel: "English 0861 - Stage 9",
        stageLabel: "Stage 9",
        lessonId: "lesson-5",
        lessonTitle: "Understanding Narrative Structure",
        activityId: "activity-5",
        activityTitle: "Knowledge Check",
        readingContent: teachingProseOnly,
        questions: [
            {
                questionId: "q1",
                questionIndex: 1,
                questionText: "What is a non-linear narrative?",
                questionType: "comprehension",
            },
        ],
    });
    strict_1.default.equal(result.integrityStatus, "OK");
    strict_1.default.equal(result.questions[0].integrityStatus, "OK");
});
(0, node_test_1.default)("summary totals reflect OK, WARNING and FAIL counts", () => {
    const summary = (0, languageSourceAudit_1.summarizeLanguageAudit)([
        {
            subjectKey: "english",
            subjectLabel: "English 0861 - Stage 9",
            stageLabel: "Stage 9",
            lessonId: "lesson-ok",
            lessonTitle: "OK lesson",
            activityId: "activity-ok",
            activityTitle: "OK activity",
            readingClassification: {
                overallKind: "teaching-prose",
                segments: [],
                substantialSourceCount: 0,
                shortExampleCount: 0,
                teachingProseCount: 0,
                totalCandidateEvidenceCount: 0,
                supportsIndependentPractice: false,
            },
            integrityStatus: "OK",
            questions: [],
        },
        {
            subjectKey: "english-stage-8",
            subjectLabel: "English 0861 - Stage 8",
            stageLabel: "Stage 8",
            lessonId: "lesson-warning",
            lessonTitle: "Warning lesson",
            activityId: "activity-warning",
            activityTitle: "Warning activity",
            readingClassification: {
                overallKind: "substantial-source",
                segments: [],
                substantialSourceCount: 1,
                shortExampleCount: 0,
                teachingProseCount: 0,
                totalCandidateEvidenceCount: 3,
                supportsIndependentPractice: true,
            },
            integrityStatus: "WARNING",
            questions: [],
        },
        {
            subjectKey: "afrikaans",
            subjectLabel: "Afrikaans - Stage 9",
            stageLabel: "Grade 9",
            lessonId: "lesson-fail",
            lessonTitle: "Fail lesson",
            activityId: "activity-fail",
            activityTitle: "Fail activity",
            readingClassification: {
                overallKind: "teaching-prose",
                segments: [],
                substantialSourceCount: 0,
                shortExampleCount: 0,
                teachingProseCount: 0,
                totalCandidateEvidenceCount: 0,
                supportsIndependentPractice: false,
            },
            integrityStatus: "FAIL",
            questions: [],
        },
    ]);
    strict_1.default.equal(summary.totalActivitiesScanned, 3);
    strict_1.default.equal(summary.totalOk, 1);
    strict_1.default.equal(summary.totalWarning, 1);
    strict_1.default.equal(summary.totalFail, 1);
});
