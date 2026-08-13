import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyReadingSourceMaterial,
  hasSufficientEvidenceForQuestion,
  lessonRequiresSubstantialSourceMaterial,
  questionRequiresSourceEvidence,
} from "./languageSourceIntegrity";

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

const twoTextReading = `
Heading: Text 1

The rain hammered against the roof while Lindiwe waited for the phone to ring. Every second felt longer than the last. She paced from the window to the table and back again, listening for footsteps in the hallway. When the lights flickered, she pressed the letter closer to her chest and wondered whether the call would bring relief or disaster.

Heading: Text 2

A dry wind swept the field as Musa opened the letter. He smiled, but his hands were shaking. The paper trembled while he read the final paragraph for a second time, and the silence around him felt sharper than before. He looked toward the gate, then folded the page carefully as if one careless movement might change what the words had already decided.
`;

test("questionRequiresSourceEvidence detects extract-dependent English wording", () => {
  assert.equal(
    questionRequiresSourceEvidence({
      subjectKey: "english",
      questionText:
        "Identify two examples from the extract where the writer uses language to create suspense.",
      questionType: "comprehension",
    }),
    true,
  );
});

test("questionRequiresSourceEvidence leaves ordinary knowledge questions allowed", () => {
  assert.equal(
    questionRequiresSourceEvidence({
      subjectKey: "english",
      questionText: "What is a non-linear narrative?",
      questionType: "comprehension",
    }),
    false,
  );
});

test("classifyReadingSourceMaterial treats teaching prose and one-sentence examples as insufficient", () => {
  const classification = classifyReadingSourceMaterial(
    teachingProseOnly,
    "english",
  );

  assert.equal(classification.overallKind, "short-illustrative-example");
  assert.equal(classification.substantialSourceCount, 0);
  assert.equal(classification.supportsIndependentPractice, false);
});

test("teaching prose only plus quote request is blocked", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "english",
    questionText: "Quote two phrases from the extract that create suspense.",
    questionType: "language-analysis",
    readingContent: teachingProseOnly,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_substantial_source");
});

test("one illustrative sentence plus identify two examples is blocked", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "english",
    questionText:
      "Identify two examples from the extract where the writer uses language to create suspense and explain their effect.",
    questionType: "language-analysis",
    readingContent: teachingProseOnly,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_substantial_source");
});

test("substantial English extract with adequate evidence allows an evidence question", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "english",
    questionText:
      "Identify two examples from the extract where the writer uses language to create suspense.",
    questionType: "language-analysis",
    readingContent: substantialEnglishExtract,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "sufficient");
});

test("two-text comparison with only one text is blocked", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "english",
    questionText: "Compare the two texts and explain how the writers create tension.",
    questionType: "interpretation",
    readingContent: substantialEnglishExtract,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_second_text");
});

test("ordinary non-source-dependent English question is allowed", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "english-stage-8",
    questionText: "Explain what a non-linear narrative is.",
    questionType: "comprehension",
    readingContent: teachingProseOnly,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "not_required");
});

test("Afrikaans teaching prose plus haal twee voorbeelde aan is blocked", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "afrikaans",
    questionText: "Haal twee voorbeelde van beeldspraak uit die teks aan.",
    questionType: "taal-en-toon",
    readingContent: "Heading: Taalgebruik\n\nBeeldspraak help om betekenis interessanter te maak.\n\nVoorbeeld: Die son glimlag oor die see.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_substantial_source");
});

test("Afrikaans substantial text with supported evidence question is allowed", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "afrikaans-stage-8",
    questionText: "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
    questionType: "taal-en-toon",
    readingContent: substantialAfrikaansExtract,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "sufficient");
});

test("Afrikaans comparison question with one text is blocked", () => {
  const result = hasSufficientEvidenceForQuestion({
    subjectKey: "afrikaans-stage-8",
    questionText: "Vergelyk die tekste en verduidelik hoe die skrywers spanning skep.",
    questionType: "taal-en-toon",
    readingContent: substantialAfrikaansExtract,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_second_text");
});

test("lessonRequiresSubstantialSourceMaterial detects English analytical lessons", () => {
  assert.equal(
    lessonRequiresSubstantialSourceMaterial({
      subjectKey: "english",
      readingTitle: "Understanding Narrative Structure",
      instruction: "Teach learners how writers use language to create suspense in a non-linear narrative.",
    }),
    true,
  );
});

test("lessonRequiresSubstantialSourceMaterial detects Afrikaans analytical lessons", () => {
  assert.equal(
    lessonRequiresSubstantialSourceMaterial({
      subjectKey: "afrikaans",
      readingTitle: "Beeldspraak en toon",
      instruction: "Leer leerders hoe om beeldspraak, toon en stemming in 'n gedig te ontleed.",
    }),
    true,
  );
});

test("two-text reading is classified as substantial source material", () => {
  const classification = classifyReadingSourceMaterial(twoTextReading, "english");
  assert.equal(classification.substantialSourceCount >= 2, true);
});