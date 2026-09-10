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
