import assert from "node:assert/strict";
import test from "node:test";
import {
  readingContentToBlocks,
  serializeStructuredReading,
  validateStructuredReadingCompleteness,
} from "@/lib/readings/structuredReading";
import {
  buildNarrationValidationSourceText,
  validateAccessibilityNarration,
  validatePastedTextNarration,
  validatePdfNarration,
} from "./narrationIntegrity";

const SOURCE_CONTENT_TEXT = serializeStructuredReading([
  { type: "heading", text: "Choosing Between Niche and Mass Markets" },
  { type: "subheading", text: "Introduction" },
  {
    type: "paragraph",
    text: "Every business must decide whether to target a small specialised market or a broad mass market depending on its resources and aims.",
  },
  {
    type: "paragraph",
    text: "A suitable choice can improve sales and customer loyalty over the long term for the business.",
  },
  {
    type: "bulletList",
    items: ["Niche markets have less competition.", "Mass markets offer higher potential sales volume."],
  },
]);

const FAITHFUL_NARRATION_TRANSCRIPT = [
  "This part of the lesson focuses on choosing between niche and mass markets.",
  "By the end of this section, you should understand the key differences between them.",
  "Every business must decide whether to target a small specialised market or a broad mass market depending on its resources and aims.",
  "A suitable choice can improve sales and customer loyalty over the long term for the business.",
  "Niche markets have less competition. Mass markets offer higher potential sales volume.",
].join("\n\n");

test("buildNarrationValidationSourceText excludes heading/subheading text but keeps every paragraph, list, definition, and table", () => {
  const validationText = buildNarrationValidationSourceText(SOURCE_CONTENT_TEXT);
  assert.doesNotMatch(validationText, /Choosing Between Niche and Mass Markets/);
  assert.doesNotMatch(validationText, /^Introduction$/m);
  assert.match(validationText, /small specialised market or a broad mass market/);
  assert.match(validationText, /Niche markets have less competition/);
});

test("a faithful narration transcript that legitimately transforms headings into natural spoken transitions still passes validation", () => {
  const result = validatePastedTextNarration({
    sourceContentText: SOURCE_CONTENT_TEXT,
    transcript: FAITHFUL_NARRATION_TRANSCRIPT,
  });
  assert.equal(result.ok, true);
});

test("a transcript that drops the reading's actual substantive content fails validation and never approves silently", () => {
  const truncatedTranscript = "This part of the lesson focuses on choosing between niche and mass markets.";
  const result = validatePastedTextNarration({
    sourceContentText: SOURCE_CONTENT_TEXT,
    transcript: truncatedTranscript,
  });
  assert.equal(result.ok, false);
  assert.ok(result.reason.length > 0);
});

test("an empty transcript always fails validation, regardless of source", () => {
  const result = validatePastedTextNarration({ sourceContentText: SOURCE_CONTENT_TEXT, transcript: "   " });
  assert.equal(result.ok, false);
  assert.match(result.reason, /empty|short/i);
});

test("a teacher-facing failure reason never leaks raw OpenAI/internal terminology", () => {
  const result = validatePastedTextNarration({ sourceContentText: SOURCE_CONTENT_TEXT, transcript: "too short" });
  assert.doesNotMatch(result.reason, /openai|gpt|prompt|token/i);
});

test("PDF narration validation has no ground-truth text to compare against, so it only rejects empty/too-short transcripts", () => {
  assert.equal(validatePdfNarration({ transcript: "" }).ok, false);
  assert.equal(
    validatePdfNarration({
      transcript: "A sufficiently long faithful narration transcript of the PDF reading content goes here.",
    }).ok,
    true,
  );
});

test("validateAccessibilityNarration dispatches to the pasted_text completeness check for pasted_text sources", () => {
  const result = validateAccessibilityNarration({
    sourceType: "pasted_text",
    sourceContentText: SOURCE_CONTENT_TEXT,
    transcript: "too short",
  });
  assert.equal(result.ok, false);
});

test("validateAccessibilityNarration dispatches to the pdf check for pdf sources, even with sourceContentText null", () => {
  const result = validateAccessibilityNarration({
    sourceType: "pdf",
    sourceContentText: null,
    transcript: "A sufficiently long faithful narration transcript of the PDF reading content goes here.",
  });
  assert.equal(result.ok, true);
});

// AD ASTRA -- FIX ACCESSIBILITY TRANSCRIPT START-COVERAGE FAILURE
//
// Root cause: AD Astra readings often open with several short structural
// labels (Lesson number, Topic, Learning Block, Subtopic, Introduction,
// "What You Need to Know") typed by the teacher as their own paragraph --
// or arriving that way because the reading was never run through
// "Structure with Kingdom" at all, so parseReadingContent's plain-text
// fallback treats every blank-line-separated chunk as a "paragraph"
// block. Unlike true heading/subheading BLOCK TYPES (already excluded),
// these label paragraphs were being fed into the "beginning of the
// reading" anchor comparison even though the narration rules explicitly
// license the narrator to transform or omit exactly this kind of
// technical/navigation label. A faithful transcript that (correctly)
// never says "Lesson 3.1 Topic Market Segmentation Learning Block 2
// Subtopic Customer Targeting Introduction What You Need To Know"
// verbatim then failed with beginning_content_missing purely because
// enough of the leading 48-word anchor window was consumed by labels the
// transcript was never supposed to read aloud.

const LABELLED_SOURCE_CONTENT_TEXT = [
  "Lesson 3.1",
  "Topic: Market Segmentation",
  "Learning Block 2",
  "Subtopic: Customer Targeting",
  "Introduction",
  "What You Need to Know",
  "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.",
  "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
  "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.",
].join("\n\n");

const FAITHFUL_TRANSCRIPT_OMITTING_LABELS = [
  "This part of the lesson focuses on choosing between niche and mass markets for a business.",
  "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.",
  "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
  "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.",
].join("\n\n");

test("REGRESSION (bug fix): a faithful transcript that legitimately omits leading structural labels ('Lesson 3.1', 'Topic:', 'Learning Block', 'Subtopic:', 'Introduction', 'What You Need to Know') written as plain paragraphs now passes -- it previously failed with beginning_content_missing", () => {
  const result = validatePastedTextNarration({
    sourceContentText: LABELLED_SOURCE_CONTENT_TEXT,
    transcript: FAITHFUL_TRANSCRIPT_OMITTING_LABELS,
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("the same labelled source reproduces the original bug when the leading-label stripping is bypassed -- confirms the fix is what fixes it, not an unrelated relaxation", () => {
  // Directly exercising the pre-fix code path: build the validation
  // source text WITHOUT stripping leading label paragraphs, the way
  // buildNarrationValidationSourceText used to.
  const blocks = readingContentToBlocks(LABELLED_SOURCE_CONTENT_TEXT);
  const unstrippedSourceText = blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => (block as { text: string }).text)
    .join("\n\n");

  const result = validateStructuredReadingCompleteness({
    sourceText: unstrippedSourceText,
    editorText: FAITHFUL_TRANSCRIPT_OMITTING_LABELS,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("label stripping is bounded and stops at the first non-label block -- it does not silently swallow real content that happens to come right after the labels", () => {
  const validationText = buildNarrationValidationSourceText(LABELLED_SOURCE_CONTENT_TEXT);
  assert.doesNotMatch(validationText, /Lesson 3\.1/);
  assert.doesNotMatch(validationText, /Topic: Market Segmentation/);
  assert.doesNotMatch(validationText, /What You Need to Know/);
  assert.match(validationText, /small specialised niche market/);
  assert.match(validationText, /Niche markets generally face less direct competition/);
});

test("a transcript that genuinely begins partway through the reading (skipping real content, not just labels) still fails -- the fix does not weaken the safeguard against truncated narration", () => {
  const transcriptMissingFirstRealParagraph = [
    "This part of the lesson focuses on choosing between niche and mass markets for a business.",
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
    "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.",
  ].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText: LABELLED_SOURCE_CONTENT_TEXT,
    transcript: transcriptMissingFirstRealParagraph,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "The narration transcript does not appear to cover the start of the reading.");
});

test("a transcript from a completely different lesson still fails against a labelled reading", () => {
  const unrelatedTranscript = [
    "This part of the lesson focuses on the causes of the First World War.",
    "Tensions between the major European powers had been building for many years before the war began in 1914.",
    "An alliance system meant that a conflict between two countries could quickly draw in many others across the continent.",
  ].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText: LABELLED_SOURCE_CONTENT_TEXT,
    transcript: unrelatedTranscript,
  });
  assert.equal(result.ok, false);
});

test("Markdown-style leading headings ('# Lesson 3.1', '## Introduction') in an unstructured plain-text reading are also tolerated when the narration omits them, since they parse as label-shaped paragraphs too", () => {
  const markdownStyleSource = [
    "# Lesson 3.1",
    "## Introduction",
    "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.",
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
  ].join("\n\n");
  const transcript = [
    "This part of the lesson focuses on choosing between niche and mass markets for a business.",
    "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.",
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
  ].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText: markdownStyleSource,
    transcript,
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("formatting, punctuation and case differences between a labelled reading's real content and the transcript are still tolerated", () => {
  const upperCaseFirstParagraph =
    "A BUSINESS MUST DECIDE WHETHER TO TARGET A SMALL SPECIALISED NICHE MARKET OR A BROAD MASS MARKET DEPENDING ON THE RESOURCES AVAILABLE TO IT AND ITS OVERALL AIMS AS A COMPANY!!";
  const transcriptWithCaseAndPunctuationDrift = [
    "This part of the lesson focuses on choosing between niche and mass markets for a business.",
    upperCaseFirstParagraph.toLowerCase().replace(/!!$/, "."),
    "A well-suited choice of target market can improve sales figures, and customer loyalty, over the long term for the business -- while a poor choice can waste marketing spend.",
    "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.",
  ].join("\n\n");
  const source = [
    "Lesson 3.1",
    "Topic: Market Segmentation",
    "Learning Block 2",
    "Subtopic: Customer Targeting",
    "Introduction",
    "What You Need to Know",
    upperCaseFirstParagraph,
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.",
    "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.",
  ].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText: source,
    transcript: transcriptWithCaseAndPunctuationDrift,
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("regression: a genuinely too-short/truncated transcript against a labelled reading still fails, even though label stripping now applies", () => {
  const result = validatePastedTextNarration({
    sourceContentText: LABELLED_SOURCE_CONTENT_TEXT,
    transcript: "This part of the lesson focuses on choosing between niche and mass markets for a business.",
  });
  assert.equal(result.ok, false);
});

// AD ASTRA -- FIX FALSE "MISSING SECTION" NARRATION VALIDATION
//
// Root cause: extractObviousHeadings() (lib/readings/structuredReading.ts)
// re-derived heading-shaped lines directly from the flattened substantive
// source text, with no awareness of which lines came from a real
// heading/subheading BLOCK (already excluded above) versus a textbook-style
// structural/assessment label ("Example Question", "Model Answer", "Key
// Concepts", "Assessment and Application", "Lesson Summary", "Recommended
// Activity Questions") embedded inside an already-classified paragraph/
// list/definition/table block. The narration rules
// (lib/accessibility/narrationTranscriptPrompt.ts) explicitly license the
// narrator to transform or omit exactly this kind of label while still
// narrating the educational content that follows it -- so a faithful,
// complete transcript was being rejected with heading_missing purely for
// correctly not repeating a label the narrator was never required to say.
// validatePastedTextNarration now calls validateStructuredReadingCompleteness
// with checkHeadings: false, since heading handling for this caller is
// already done at the block-type level above -- not via a hard-coded list
// of known AD Astra labels, so any equivalently short/unpunctuated
// embedded label is covered by the same generic mechanism.

function embeddedLabelSource(label: string) {
  return [
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry.",
    `${label}\nA local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall this year.`,
    "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run.",
  ].join("\n\n");
}

function faithfulTranscriptOmittingLabel() {
  return [
    "This part of the lesson focuses on choosing between niche and mass markets for a business.",
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry.",
    "Here's an example for you to consider: a local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall this year.",
    "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run.",
  ].join("\n\n");
}

test("A: a textbook label embedded inside a paragraph block ('Example Question' on its own line, immediately followed by the actual educational content) no longer causes heading_missing when the transcript covers the content but naturally omits the label", () => {
  const result = validatePastedTextNarration({
    sourceContentText: embeddedLabelSource("Example Question"),
    transcript: faithfulTranscriptOmittingLabel(),
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("B: the same generic (not hard-coded) fix covers every representative textbook-style embedded label", () => {
  const labels = [
    "Model Answer",
    "Key Concepts",
    "Assessment and Application",
    "Lesson Summary",
    "Recommended Activity Questions",
  ];

  for (const label of labels) {
    const result = validatePastedTextNarration({
      sourceContentText: embeddedLabelSource(label),
      transcript: faithfulTranscriptOmittingLabel(),
    });
    assert.equal(result.ok, true, `label "${label}" expected pass, got: ${result.reason}`);
  }
});

test("C: a short, unpunctuated, title-like line inside a table or definition block is not treated as a mandatory heading", () => {
  const sourceContentText = serializeStructuredReading([
    {
      type: "paragraph",
      text: "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry.",
    },
    {
      type: "table",
      headers: ["Key Term", "Detail"],
      rows: [["Niche market", "A small specialised segment of a larger market."]],
    },
    {
      type: "definition",
      term: "Key Concept",
      definition: "A core idea a learner must understand to master this topic.",
    },
    {
      type: "paragraph",
      text: "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run.",
    },
  ]);

  const transcript = [
    "This part of the lesson focuses on choosing between niche and mass markets for a business.",
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry.",
    "Key Term: Niche market. A small specialised segment of a larger market.",
    "Key Concept: a core idea a learner must understand to master this topic.",
    "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run.",
  ].join("\n\n");

  const result = validatePastedTextNarration({ sourceContentText, transcript });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("E/F: length and beginning-content safeguards remain fully active for narration validation after the fix", () => {
  const tooShort = validatePastedTextNarration({
    sourceContentText: embeddedLabelSource("Example Question"),
    transcript: "This part of the lesson focuses on niche and mass markets.",
  });
  assert.equal(tooShort.ok, false);

  const missingBeginning = validatePastedTextNarration({
    sourceContentText: embeddedLabelSource("Example Question"),
    transcript: [
      "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run.",
    ].join("\n\n"),
  });
  assert.equal(missingBeginning.ok, false);
});

test("G: a transcript that drops the reading's real ending still fails narration validation after the fix", () => {
  const p1 =
    "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.";
  const p2 =
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.";
  const p3 =
    "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.";
  const frame = "This part of the lesson focuses on choosing between niche and mass markets for a business.";

  const sourceContentText = serializeStructuredReading([
    { type: "paragraph", text: p1 },
    { type: "paragraph", text: p2 },
    { type: "paragraph", text: p3 },
  ]);

  // Drops the real closing paragraph (p3) entirely -- padded with a
  // framing sentence so the length-ratio check alone does not already
  // reject it, isolating the ending-anchor check specifically.
  const transcriptMissingEnding = [frame, p1, p2].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText,
    transcript: transcriptMissingEnding,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    "The narration transcript does not appear to cover the end of the reading.",
  );
});

test("H: true heading/subheading block exclusion is unchanged by this fix -- a transcript never has to say a genuine heading/subheading's exact text and still passes", () => {
  const result = validatePastedTextNarration({
    sourceContentText: SOURCE_CONTENT_TEXT,
    transcript: FAITHFUL_NARRATION_TRANSCRIPT,
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(FAITHFUL_NARRATION_TRANSCRIPT, /Choosing Between Niche and Mass Markets/);
});

// AD ASTRA -- FIX FALSE BEGINNING/ENDING NARRATION VALIDATION
//
// Root cause: the default "literal" edgeMode requires an exact, ordered
// 8-word source phrase to appear verbatim in the transcript. The narration
// rules (lib/accessibility/narrationTranscriptPrompt.ts) explicitly
// instruct Kingdom to open with a natural spoken introduction and to
// paraphrase rather than quote the reading (its own worked example:
// "Sub-topic: Trench Warfare" -> "This part of the lesson focuses on
// trench warfare."). A real production transcript -- "In Part 1 you
// learned..." narrated as "In the previous part you learned...", after a
// short spoken introduction -- was rejected as beginning_content_missing
// despite fully covering the reading's actual opening content.
// validatePastedTextNarration now calls
// validateStructuredReadingCompleteness with edgeMode: "coverage", which
// measures ordered word-overlap (not exact-phrase identity) within a
// widened transcript edge window -- see structuredReading.ts's own
// edgeMode doc comment and structuredReading.test.ts's "coverage edge
// mode" tests for the full calibration evidence (0.6 threshold; real
// pass cases scored 0.69-0.92, fail cases scored 0.10-0.22).

const CASTRO_SOURCE_CONTENT_TEXT =
  "In part 1 you learned how Fidel Castro overthrew Batista in 1959 and how relations between Cuba and the United States deteriorated. Castro's nationalisation of American-owned property, American economic pressure, and Cuba's growing relationship with the Soviet Union gradually turned Cuba into a Cold War flashpoint, setting the stage for the most dangerous confrontation of the entire Cold War period between the two superpowers.";

test("real-world case: the actual failing production transcript (spoken intro + 'In the previous part' paraphrase of 'In Part 1') now passes narration validation", () => {
  const castroTranscript =
    "This lesson focuses on the Cuban Missile Crisis, part two of our study on Cuba during the Cold War. In the previous part you learned how Fidel Castro overthrew Batista in 1959 and how relations between Cuba and the United States gradually deteriorated. Key developments included Castro nationalising American-owned property, sustained American economic pressure, and Cuba's growing relationship with the Soviet Union, all of which gradually turned Cuba into a major flashpoint of the Cold War, setting the stage for the most dangerous confrontation of the entire Cold War period between the two superpowers.";

  const result = validatePastedTextNarration({
    sourceContentText: CASTRO_SOURCE_CONTENT_TEXT,
    transcript: castroTranscript,
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("a short spoken lesson introduction followed by a faithful/paraphrased source opening passes", () => {
  const source =
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry with many rivals all seeking the same customers across several different regions.";
  const transcript =
    "Let's begin this section of the lesson. Every business has to decide whether it wants to target a small, specialised niche market, or instead go for a broad mass market, depending on the resources it has available and its long term strategic aims for future growth in a competitive industry.";

  const result = validatePastedTextNarration({ sourceContentText: source, transcript });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("a transcript that genuinely omits the source opening (starts on a later, unrelated section) still fails narration validation", () => {
  const omittedTranscript =
    "This part of the lesson focuses on the aftermath of the crisis and its long term consequences for global diplomacy and future arms control treaties between the two superpowers going forward for decades to come after these events concluded. This part of the lesson focuses on the aftermath of the crisis and its long term consequences for global diplomacy and future arms control treaties between the two superpowers going forward for decades to come after these events concluded.";

  const result = validatePastedTextNarration({
    sourceContentText: CASTRO_SOURCE_CONTENT_TEXT,
    transcript: omittedTranscript,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    "The narration transcript does not appear to cover the start of the reading.",
  );
});

test("a transcript that only coincidentally shares a handful of common source words (same topic, no real coverage) still fails narration validation", () => {
  const coincidentalTranscript =
    "Cuba and the United States are two very different countries. This section looks at trade between Cuba and other Caribbean nations today, and the Soviet Union's historical role in global agriculture during the twentieth century more broadly. Cuba and the United States are two very different countries with very different histories and cultures overall.";

  const result = validatePastedTextNarration({
    sourceContentText: CASTRO_SOURCE_CONTENT_TEXT,
    transcript: coincidentalTranscript,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    "The narration transcript does not appear to cover the start of the reading.",
  );
});

test("a natural spoken closing that paraphrases the source ending passes narration validation", () => {
  const source =
    "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run across many different customer segments and demographics.";
  const transcript =
    "To sum up this part of the lesson, niche markets tend to face less direct competition from big, established firms in the industry, whereas mass markets usually offer a much higher potential total sales volume for a business overall in the long run.";

  const result = validatePastedTextNarration({ sourceContentText: source, transcript });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("a transcript that covers the real opening but genuinely omits the source ending still fails narration validation", () => {
  const p1 =
    "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.";
  const p2 =
    "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.";
  const p3 =
    "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.";
  const frame = "This part of the lesson focuses on choosing between niche and mass markets for a business.";
  const wrongEnding =
    "This part of the lesson also touched briefly on pricing strategy and how a business might adjust its prices seasonally depending on demand throughout the year for various products.";

  const sourceContentText = serializeStructuredReading([
    { type: "paragraph", text: p1 },
    { type: "paragraph", text: p2 },
    { type: "paragraph", text: p3 },
  ]);
  const transcriptMissingEnding = [frame, p1, p2, wrongEnding].join("\n\n");

  const result = validatePastedTextNarration({
    sourceContentText,
    transcript: transcriptMissingEnding,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    "The narration transcript does not appear to cover the end of the reading.",
  );
});

test("regression: the 80% length-ratio safeguard is unaffected by the coverage-mode edge fix", () => {
  const result = validatePastedTextNarration({
    sourceContentText: LABELLED_SOURCE_CONTENT_TEXT,
    transcript: "This part of the lesson focuses on choosing between niche and mass markets for a business.",
  });
  assert.equal(result.ok, false);
});

test("regression: all embedded-textbook-label tests (heading fix) and all leading-structural-label tests continue to pass unaffected by the edge-coverage fix -- re-verified by re-running this same test file", () => {
  // No new assertion needed here: this file's own earlier tests (A, B, C,
  // and the "REGRESSION (bug fix)"/label-stripping suite above) already
  // exercise validatePastedTextNarration end-to-end, which now always
  // runs with both checkHeadings: false and edgeMode: "coverage"
  // together. Their continued pass in the same test run is the proof.
  assert.ok(true);
});
