import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUniversalEvidenceIntegrityPrompt,
  summarizeTextReadingEvidence,
  validateGeneratedQuestionIntegrity,
  validateQuestionPlansAgainstTextReading,
} from "./questionEvidenceIntegrity";

const oneHistorySource = `
Heading: Source A

The poster showed workers marching beneath a large slogan about national unity.
`;

const twoHistorySources = `
Heading: Source A

The poster showed workers marching beneath a large slogan about national unity.

Heading: Source B

A newspaper report described public concern about rising food prices in the same period.
`;

const teachingProseOnly = `
Heading: Understanding Narrative Structure

A non-linear narrative does not tell events in the order they happened.

Definition - Non-linear narrative: A story structure that moves backwards and forwards in time.
`;

const substantialEnglishExtract = `
Heading: Teaching Extract

James stepped into the corridor and heard the floorboards crack behind him. The candle flickered and the shadows stretched across the walls. He froze when a door creaked open upstairs. A cold gust swept through the house and the flame almost died.
`;

test("text-reading preflight blocks history source comparison when only one source exists", () => {
  const result = validateQuestionPlansAgainstTextReading({
    subjectKey: "history",
    readingContent: oneHistorySource,
    questions: [
      {
        id: 1,
        questionType: "source-comparison",
      },
    ],
  });

  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0]?.reason ?? "", /two suitable sources/i);
});

test("text-reading preflight allows history source comparison when two sources exist", () => {
  const result = validateQuestionPlansAgainstTextReading({
    subjectKey: "history",
    readingContent: twoHistorySources,
    questions: [
      {
        id: 1,
        questionType: "source-comparison",
      },
    ],
  });

  assert.equal(result.issues.length, 0);
  assert.equal(result.summary.historySourceCount >= 2, true);
});

test("text-reading preflight blocks language-analysis when no substantial extract exists", () => {
  const result = validateQuestionPlansAgainstTextReading({
    subjectKey: "english",
    readingContent: teachingProseOnly,
    questions: [
      {
        id: 1,
        questionType: "language-analysis",
      },
    ],
  });

  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0]?.reason ?? "", /substantial learner-facing text/i);
});

test("generated language question still gets deterministic validation on saved text readings", () => {
  const result = validateGeneratedQuestionIntegrity({
    subjectKey: "english",
    questionType: "language-analysis",
    questionText:
      "Identify two examples from the extract where the writer uses language to create suspense.",
    readingSourceType: "pasted_text",
    readingContent: teachingProseOnly,
    integrityCheck: {
      supported: true,
      evidenceKinds: ["substantial-text"],
      evidenceCount: 2,
      notes: "Claimed to be supported.",
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /saved text reading does not contain enough defensible evidence/i);
});

test("generated language question passes when the saved text really contains enough evidence", () => {
  const result = validateGeneratedQuestionIntegrity({
    subjectKey: "english",
    questionType: "language-analysis",
    questionText:
      "Identify two examples from the extract where the writer uses language to create suspense.",
    readingSourceType: "pasted_text",
    readingContent: substantialEnglishExtract,
    integrityCheck: {
      supported: true,
      evidenceKinds: ["substantial-text"],
      evidenceCount: 2,
      notes: "The extract contains multiple suspense details.",
    },
  });

  assert.equal(result.ok, true);
});

test("PDF evidence prompt tells Kingdom to mark unsupported questions instead of inventing evidence", () => {
  const prompt = buildUniversalEvidenceIntegrityPrompt({
    subjectKey: "history",
    readingSourceType: "pdf",
    questions: [
      {
        id: 1,
        questionType: "source-comparison",
      },
    ],
  });

  assert.match(prompt, /attached PDF/i);
  assert.match(prompt, /supported": false/i);
  assert.match(prompt, /instead of inventing evidence/i);
});

test("reading summary counts context and source labels separately", () => {
  const summary = summarizeTextReadingEvidence(
    "business-studies",
    `${twoHistorySources}\n\nCase study: A bakery wants to expand into a second town.`,
  );

  assert.equal(summary.historySourceCount >= 2, true);
  assert.equal(summary.businessContextSignalCount >= 1, true);
});
