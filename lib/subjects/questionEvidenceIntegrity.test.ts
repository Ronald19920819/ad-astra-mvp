import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPdfQuestionVerificationPrompt,
  buildQuizEvidenceIntegrityPrompt,
  buildUniversalEvidenceIntegrityPrompt,
  pickPdfVerificationDetail,
  quizQuestionClaimsSpecialEvidence,
  summarizeTextReadingEvidence,
  validateGeneratedQuestionIntegrity,
  validateQuestionPlansAgainstTextReading,
  validateQuizQuestionsAgainstTextReading,
} from "./questionEvidenceIntegrity";
import { getQuestionEvidenceRequirement } from "./questionPresets";

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

// --- Lesson quiz evidence integrity ---
// Lesson quizzes have no paper/questionType presets, so these tests exercise
// the quiz-specific, type-free validation path directly.

const quizTeachingProseOnly = `
Heading: Understanding Narrative Structure

A non-linear narrative does not tell events in the order they happened.

Definition - Non-linear narrative: A story structure that moves backwards and forwards in time.
`;

// Reproduces the real "Understanding Narrative Structure" lesson reading that
// previously produced the known bad quiz question. It is long instructional
// prose with one embedded illustrative quote, and no genuinely labelled
// learner-facing extract.
const quizNonLinearNarrativeTeachingProseWithQuote = `
Heading: Non-linear Narratives

A non-linear narrative does not tell events in the order they happened.

Instead, the writer deliberately changes the sequence of events. A story might begin near the end before returning to the beginning, or it may jump backwards and forwards between different periods of time.

Imagine opening a novel with these words:

"The old castle burned as James watched everything disappear into the flames."

The reader immediately wonders how the castle caught fire and why James is there.

The writer then returns to events that happened several weeks earlier to explain the story.

Non-linear narratives encourage readers to think carefully about how different events connect and often create greater suspense or mystery.
`;

const quizSubstantialEnglishExtract = `
Heading: Teaching Extract

James stepped into the corridor and heard the floorboards crack behind him. The candle flickered and the shadows stretched across the walls. He froze when a door creaked open upstairs. A cold gust swept through the house and the flame almost died. He wanted to call out, but the silence felt heavier than the darkness itself.
`;

const quizSubstantialAfrikaansExtract = `
Heading: Uittreksel

Karla het stadig deur die donker gang geloop. Die wind het teen die vensters gefluit en die vloerplanke het onder haar voete gekraak. Skielik het 'n deur oopgeswaai en 'n koue trekwind het die kers byna doodgeblaas. Sy het haar asem opgehou toe sy 'n sagte fluistering agter haar hoor.
`;

const historyReadingWithoutSources = `
Heading: Causes of the Berlin Blockade

Tensions between the Soviet Union and the Western Allies increased after currency reforms were introduced in West Berlin. The Soviet Union responded by blockading road and rail access to the city.
`;

test("Narrative Structure regression: known bad quiz question is rejected against the real lesson reading", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "english",
    readingContent: quizNonLinearNarrativeTeachingProseWithQuote,
    questions: [
      {
        id: 2,
        questionText:
          "Identify two examples from the extract where the writer uses language to create suspense in a non-linear narrative, and explain how these examples affect the reader.",
      },
    ],
  });

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.questionId, 2);
  assert.match(result.issues[0]?.reason ?? "", /does not contain/i);
});

test("quiz integrity: an ordinary knowledge question from teaching prose is allowed", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "english",
    readingContent: quizTeachingProseOnly,
    questions: [
      { id: 1, questionText: "What is a non-linear narrative?" },
    ],
  });

  assert.equal(result.issues.length, 0);
});

test("quiz integrity: a supported question against a genuine labelled English extract is allowed", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "english",
    readingContent: quizSubstantialEnglishExtract,
    questions: [
      {
        id: 1,
        questionText:
          "Identify two examples from the extract where the writer uses language to create suspense.",
      },
    ],
  });

  assert.equal(result.issues.length, 0);
});

test("quiz integrity: a supported question against a genuine labelled Afrikaans source is allowed", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "afrikaans",
    readingContent: quizSubstantialAfrikaansExtract,
    questions: [
      {
        id: 1,
        questionText: "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
      },
    ],
  });

  assert.equal(result.issues.length, 0);
});

test("quiz integrity: Source A wording is rejected when no Source A exists in the reading", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "history",
    readingContent: historyReadingWithoutSources,
    questions: [
      {
        id: 1,
        questionText: "According to Source A, why did tensions increase during the Berlin Blockade?",
      },
    ],
  });

  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0]?.reason ?? "", /labelled source/i);
});

test("quiz integrity: an ordinary knowledge question for a non-language subject is allowed", () => {
  const result = validateQuizQuestionsAgainstTextReading({
    subjectKey: "history",
    readingContent: historyReadingWithoutSources,
    questions: [
      {
        id: 1,
        questionText: "Why did tensions increase during the Berlin Blockade?",
      },
    ],
  });

  assert.equal(result.issues.length, 0);
});

test("quiz evidence integrity prompt has no per-question-type requirement map and still forbids invented evidence", () => {
  const prompt = buildQuizEvidenceIntegrityPrompt({
    subjectKey: "english",
    readingSourceType: "pasted_text",
    readingContent: quizTeachingProseOnly,
  });

  assert.match(prompt, /never claim a source/i);
  assert.match(prompt, /ordinary questions about taught content are still allowed/i);
  assert.doesNotMatch(prompt, /question requirement map/i);
});

test("quiz evidence integrity prompt tells Kingdom to inspect the attached PDF", () => {
  const prompt = buildQuizEvidenceIntegrityPrompt({
    subjectKey: "history",
    readingSourceType: "pdf",
  });

  assert.match(prompt, /attached PDF/i);
});

// --- Independent PDF verification trigger logic (Task 2C.3) ---

test("quizQuestionClaimsSpecialEvidence: ordinary knowledge questions do not require PDF verification", () => {
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "history",
      "Why did tensions increase during the Berlin Blockade?",
    ),
    false,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "business-studies",
      "What is meant by market segmentation?",
    ),
    false,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence("english", "What is a non-linear narrative?"),
    false,
  );
});

test("quizQuestionClaimsSpecialEvidence: evidence-claiming wording is detected across subjects", () => {
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "history",
      "According to Source A, why did tensions rise?",
    ),
    true,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "history",
      "Study the map and identify the border that was closed.",
    ),
    true,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "business-studies",
      "Using the case study, explain why Cape Harvest Foods may use wholesalers.",
    ),
    true,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "english",
      "Identify two examples from the extract where the writer uses language to create suspense.",
    ),
    true,
  );
  assert.equal(
    quizQuestionClaimsSpecialEvidence(
      "afrikaans",
      "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
    ),
    true,
  );
});

test("pickPdfVerificationDetail: only escalates to high detail when a candidate needs visual evidence", () => {
  assert.equal(
    pickPdfVerificationDetail([
      { questionText: "According to Source A, why did tensions rise?" },
    ]),
    "auto",
  );
  assert.equal(
    pickPdfVerificationDetail([
      { questionText: "Study the map and identify the border that was closed." },
    ]),
    "high",
  );
});

test("Business Studies: an ordinary definition question type carries no evidenceRequirement, so PDF verification is never triggered for it", () => {
  const requirement = getQuestionEvidenceRequirement("business-studies", "define");
  assert.equal(requirement, undefined);
});

test("Business Studies: a case-study-dependent question type does carry an evidenceRequirement", () => {
  const requirement = getQuestionEvidenceRequirement("business-studies", "explain-context");
  assert.equal(requirement?.teacherFacingLabel, "business context or case-study information");
});

test("PDF question verification prompt instructs the model to verify, not answer or rewrite", () => {
  const prompt = buildPdfQuestionVerificationPrompt({
    subjectKey: "history",
    questions: [
      {
        id: 1,
        questionText: "Compare Sources A and B and explain which is more useful.",
        requirementLabel: "two suitable sources",
      },
    ],
  });

  assert.match(prompt, /you are verifying, not generating/i);
  assert.match(prompt, /do not answer, rewrite or improve/i);
  assert.match(prompt, /"questionId": 1/);
  assert.match(prompt, /two suitable sources/);
});
