import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReadingContent,
  readingContentToPlainText,
  serializeStructuredReading,
  validateStructuredReadingCompleteness,
} from "./structuredReading";

test("valid structured-reading JSON produces renderable blocks", () => {
  const content = serializeStructuredReading([
    { type: "heading", text: "Business Inputs" },
    {
      type: "paragraph",
      text: "Businesses transform inputs into outputs.",
    },
    {
      type: "bulletList",
      items: ["Land", "Labour", "Capital", "Enterprise"],
    },
    {
      type: "definition",
      term: "Labour",
      definition: "The human effort used in production.",
    },
  ]);
  const parsed = parseReadingContent(content);

  assert.equal(parsed.kind, "structured");
  assert.deepEqual(
    parsed.blocks.map((block) => block.type),
    ["heading", "paragraph", "bulletList", "definition"],
  );
  assert.match(readingContentToPlainText(content), /- Labour/);
  assert.match(
    readingContentToPlainText(content),
    /Definition - Labour: The human effort/,
  );
});

test("legacy plain text remains readable with line breaks", () => {
  const content =
    "Inputs include land, labour, capital and enterprise.\n\nLabour is human effort.";
  const parsed = parseReadingContent(content);

  assert.equal(parsed.kind, "plainText");
  assert.equal(parsed.blocks.length, 2);
  assert.equal(readingContentToPlainText(content), content);
});

test("malformed structured content is detected and raw JSON is withheld", () => {
  const content =
    '{"format":"ad-astra-structured-reading","version":1,"blocks":[';
  const parsed = parseReadingContent(content);

  assert.equal(parsed.kind, "malformed");
  assert.deepEqual(parsed.blocks, []);
  assert.equal(readingContentToPlainText(content), "");
});

test("completeness passes when headings are reformatted into markdown blocks", () => {
  const sourceText = [
    "Topic 3.1: Niche Marketing & Mass Marketing",
    "Learning Block 1 of 1",
    "Sub-topic: Choosing Between Niche and Mass Markets",
    "Introduction",
    "Every business must decide whether to target a small specialised market or a large broad market.",
    "This choice affects pricing, promotion and risk.",
  ].join("\n");

  const editorText = [
    "# Topic 3.1: Niche Marketing & Mass Marketing",
    "## Learning Block 1 of 1",
    "## Sub-topic: Choosing Between Niche and Mass Markets",
    "## Introduction",
    "Every business must decide whether to target a small specialised market or a large broad market. This choice affects pricing, promotion and risk.",
  ].join("\n\n");

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: true,
    reason: "complete",
  });
});

test("completeness passes when line reflow preserves the same content", () => {
  const sourceText = [
    "Introduction",
    "Every business must decide whether to target a small specialised market",
    "or a broad mass market depending on its resources and aims.",
    "A suitable choice can improve sales and customer loyalty.",
  ].join("\n");

  const editorText = [
    "## Introduction",
    "Every business must decide whether to target a small specialised market or a broad mass market depending on its resources and aims. A suitable choice can improve sales and customer loyalty.",
  ].join("\n\n");

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: true,
    reason: "complete",
  });
});

test("completeness fails when the real beginning is missing", () => {
  const sourceText = [
    "Topic 3.1: Niche Marketing & Mass Marketing",
    "Learning Block 1 of 1",
    "Sub-topic: Choosing Between Niche and Mass Markets",
    "Introduction",
    "Every business must decide whether to target a small specialised market or a broad market.",
    "A suitable choice can improve long-term growth.",
  ].join("\n");

  const editorText = [
    "## Introduction",
    "A suitable choice can improve long-term growth.",
  ].join("\n\n");

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: false,
    reason: "beginning_content_missing",
  });
});

test("completeness fails when the real ending is missing", () => {
  const sourceText = [
    "Introduction",
    "Every business must decide whether to target a small specialised market or a broad market.",
    "Where Could You See This?",
    "Paper 1",
    "Paper 2",
    "Lesson Summary",
    "Niche marketing targets a small specialised market while mass marketing targets a large market.",
  ].join("\n");

  const editorText = [
    "## Introduction",
    "Every business must decide whether to target a small specialised market or a broad market.",
    "## Where Could You See This?",
  ].join("\n\n");

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: false,
    reason: "ending_content_missing",
  });
});

// AD ASTRA -- FIX FALSE "MISSING SECTION" NARRATION VALIDATION
//
// extractObviousHeadings() re-derives heading-shaped lines directly from
// sourceText with no awareness of which lines came from a real
// heading/subheading block versus a structural/decorative label embedded
// inside an already-classified substantive block. checkHeadings (default
// true, unchanged) lets a caller that has already handled headings its own
// way (lib/accessibility/narrationIntegrity.ts) opt out of this
// re-derivation, without touching the length-ratio/beginning-anchor/
// ending-anchor safeguards or this function's default behaviour for its
// other caller (app/api/kingdom/structure-reading/route.ts), which still
// needs this check to catch a heading Kingdom's structuring silently
// dropped.

test("default behaviour (checkHeadings omitted) is unchanged -- a genuinely dropped obvious heading still fails with heading_missing, exactly as before this fix (protects app/api/kingdom/structure-reading's existing usage)", () => {
  const sourceText = [
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth.",
    "Example Question",
    "A local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall.",
    "Model Answer",
    "The bakery should target a niche market because it allows focused marketing and stronger customer loyalty over time for a small growing business every single year.",
  ].join("\n\n");

  const editorText = [
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth.",
    "A local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall.",
    "The bakery should target a niche market because it allows focused marketing and stronger customer loyalty over time for a small growing business every single year.",
  ].join("\n\n");

  const result = validateStructuredReadingCompleteness({ sourceText, editorText });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "heading_missing");
});

test("checkHeadings: false suppresses exactly the heading re-derivation -- the identical source/editor pair above now passes, with length/beginning/ending safeguards still active", () => {
  const sourceText = [
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth.",
    "Example Question",
    "A local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall.",
    "Model Answer",
    "The bakery should target a niche market because it allows focused marketing and stronger customer loyalty over time for a small growing business every single year.",
  ].join("\n\n");

  const editorText = [
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth.",
    "A local bakery wants to expand into online sales and must decide which customer segment offers the best long term growth opportunity for the business overall.",
    "The bakery should target a niche market because it allows focused marketing and stronger customer loyalty over time for a small growing business every single year.",
  ].join("\n\n");

  const result = validateStructuredReadingCompleteness({
    sourceText,
    editorText,
    checkHeadings: false,
  });
  assert.deepEqual(result, { ok: true, reason: "complete" });
});

test("checkHeadings: false does not weaken the length-ratio safeguard", () => {
  const sourceText = [
    "Introduction",
    "Every business must decide whether to target a small specialised market or a broad market depending on customer needs, competition, budget, sales goals and long-term strategy.",
    "Advantages include focused promotion, clearer branding and stronger loyalty.",
    "Disadvantages include limited demand and dependence on fewer customers.",
  ].join("\n");
  const editorText = "Introduction broad market clearer branding.";

  const result = validateStructuredReadingCompleteness({
    sourceText,
    editorText,
    checkHeadings: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "output_too_short");
});

const ANCHOR_TEST_P1 =
  "A business must decide whether to target a small specialised niche market or a broad mass market depending on the resources available to it and its overall aims as a company.";
const ANCHOR_TEST_P2 =
  "A well suited choice of target market can improve sales figures and customer loyalty over the long term for the business, while a poor choice can waste marketing spend.";
const ANCHOR_TEST_P3 =
  "Niche markets generally face less direct competition from large established firms in the industry. Mass markets usually offer a much higher potential total sales volume for a business overall.";
const ANCHOR_TEST_FRAME =
  "This part of the lesson focuses on choosing between niche and mass markets for a business.";

test("checkHeadings: false does not weaken the beginning-anchor safeguard", () => {
  const sourceText = [ANCHOR_TEST_P1, ANCHOR_TEST_P2, ANCHOR_TEST_P3].join("\n\n");
  // Drops the real opening paragraph (P1) entirely -- padded with a
  // framing sentence so the length-ratio check alone does not already
  // reject it, isolating the beginning-anchor check specifically.
  const editorText = [ANCHOR_TEST_FRAME, ANCHOR_TEST_P2, ANCHOR_TEST_P3].join("\n\n");

  const result = validateStructuredReadingCompleteness({
    sourceText,
    editorText,
    checkHeadings: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("checkHeadings: false does not weaken the ending-anchor safeguard", () => {
  const sourceText = [ANCHOR_TEST_P1, ANCHOR_TEST_P2, ANCHOR_TEST_P3].join("\n\n");
  // Drops the real closing paragraph (P3) entirely -- padded with a
  // framing sentence so the length-ratio check alone does not already
  // reject it, isolating the ending-anchor check specifically.
  const editorText = [ANCHOR_TEST_FRAME, ANCHOR_TEST_P1, ANCHOR_TEST_P2].join("\n\n");

  const result = validateStructuredReadingCompleteness({
    sourceText,
    editorText,
    checkHeadings: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ending_content_missing");
});

// AD ASTRA -- FIX FALSE BEGINNING/ENDING NARRATION VALIDATION
//
// The default "literal" edgeMode (unchanged, used as-is by
// app/api/kingdom/structure-reading/route.ts) requires an exact, ordered
// 8-word source phrase to appear verbatim in the output. Accessibility
// narration is explicitly instructed
// (lib/accessibility/narrationTranscriptPrompt.ts) to open with a natural
// spoken introduction and to paraphrase rather than quote the reading, so
// a real production transcript -- "In Part 1 you learned..." narrated as
// "In the previous part you learned...", after a short spoken
// introduction -- was rejected as beginning_content_missing despite fully
// covering the reading's actual opening content. edgeMode: "coverage"
// instead measures what fraction of the source's own edge-window words
// (extractMeaningfulWords, first/last EDGE_WORD_LIMIT=48 words) reappear,
// in order (longest-common-subsequence, not exact-phrase), inside a
// correspondingly widened transcript edge window
// (NARRATION_EDGE_SEARCH_MULTIPLIER=3x), so a bounded spoken
// introduction/closing is tolerated. NARRATION_EDGE_COVERAGE_THRESHOLD
// (0.6) was set from the measured scores below: every faithful-paraphrase
// case scores 0.69-0.92; every genuine-omission/coincidental-overlap case
// scores 0.10-0.22 -- a wide margin either side of 0.6.

const CASTRO_SOURCE =
  "In part 1 you learned how Fidel Castro overthrew Batista in 1959 and how relations between Cuba and the United States deteriorated. Castro's nationalisation of American-owned property, American economic pressure, and Cuba's growing relationship with the Soviet Union gradually turned Cuba into a Cold War flashpoint, setting the stage for the most dangerous confrontation of the entire Cold War period between the two superpowers.";

test("coverage edge mode: PASS -- the real production transcript (spoken intro + 'In the previous part' paraphrase of 'In Part 1') is no longer rejected as beginning_content_missing", () => {
  const castroTranscript =
    "This lesson focuses on the Cuban Missile Crisis, part two of our study on Cuba during the Cold War. In the previous part you learned how Fidel Castro overthrew Batista in 1959 and how relations between Cuba and the United States gradually deteriorated. Key developments included Castro nationalising American-owned property, sustained American economic pressure, and Cuba's growing relationship with the Soviet Union, all of which gradually turned Cuba into a major flashpoint of the Cold War, setting the stage for the most dangerous confrontation of the entire Cold War period between the two superpowers.";

  const result = validateStructuredReadingCompleteness({
    sourceText: CASTRO_SOURCE,
    editorText: castroTranscript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("coverage edge mode: literal mode still fails on the exact same real-world case, confirming coverage mode is what fixes it (not an unrelated relaxation)", () => {
  const castroTranscript =
    "This lesson focuses on the Cuban Missile Crisis, part two of our study on Cuba during the Cold War. In the previous part you learned how Fidel Castro overthrew Batista in 1959 and how relations between Cuba and the United States gradually deteriorated. Key developments included Castro nationalising American-owned property, sustained American economic pressure, and Cuba's growing relationship with the Soviet Union, all of which gradually turned Cuba into a major flashpoint of the Cold War, setting the stage for the most dangerous confrontation of the entire Cold War period between the two superpowers.";

  const result = validateStructuredReadingCompleteness({
    sourceText: CASTRO_SOURCE,
    editorText: castroTranscript,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("coverage edge mode: PASS -- a short spoken introduction followed by faithful/paraphrased source opening", () => {
  const source =
    "Every business must decide whether to target a small specialised niche market or a broad mass market depending on its resources and long term strategic aims for future growth in a competitive industry with many rivals all seeking the same customers across several different regions.";
  const transcript =
    "Let's begin this section of the lesson. Every business has to decide whether it wants to target a small, specialised niche market, or instead go for a broad mass market, depending on the resources it has available and its long term strategic aims for future growth in a competitive industry.";

  const result = validateStructuredReadingCompleteness({
    sourceText: source,
    editorText: transcript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("coverage edge mode: FAIL -- a transcript that genuinely omits the source opening (starts on a later, different section) still fails", () => {
  const omittedTranscript =
    "This part of the lesson focuses on the aftermath of the crisis and its long term consequences for global diplomacy and future arms control treaties between the two superpowers going forward for decades to come after these events concluded. This part of the lesson focuses on the aftermath of the crisis and its long term consequences for global diplomacy and future arms control treaties between the two superpowers going forward for decades to come after these events concluded.";

  const result = validateStructuredReadingCompleteness({
    sourceText: CASTRO_SOURCE,
    editorText: omittedTranscript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("coverage edge mode: FAIL -- a transcript that only coincidentally shares a handful of common source words (same topic, no real coverage) still fails", () => {
  const coincidentalTranscript =
    "Cuba and the United States are two very different countries. This section looks at trade between Cuba and other Caribbean nations today, and the Soviet Union's historical role in global agriculture during the twentieth century more broadly. Cuba and the United States are two very different countries with very different histories and cultures overall.";

  const result = validateStructuredReadingCompleteness({
    sourceText: CASTRO_SOURCE,
    editorText: coincidentalTranscript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("coverage edge mode: FAIL -- same-topic vocabulary describing a genuinely different, later section still fails (harder adversarial case: common words like 'the', 'and', 'cuba', 'united', 'states' recur without real coverage)", () => {
  const laterSectionTranscript =
    "Later in the Cold War, the United States and Cuba experienced further tension. The Soviet Union continued to support Cuba economically for many more years. Trade between Cuba and the United States remained restricted for decades after the crisis, and relations only slowly began to improve much later, long after the original events had already concluded.";

  const result = validateStructuredReadingCompleteness({
    sourceText: CASTRO_SOURCE,
    editorText: laterSectionTranscript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "beginning_content_missing");
});

test("coverage edge mode: PASS -- a natural spoken closing that paraphrases the source ending", () => {
  const source =
    "Niche markets generally face less direct competition from large established firms in the industry, while mass markets usually offer a much higher potential total sales volume for a business overall in the long run across many different customer segments and demographics.";
  const transcript =
    "To sum up this part of the lesson, niche markets tend to face less direct competition from big, established firms in the industry, whereas mass markets usually offer a much higher potential total sales volume for a business overall in the long run.";

  const result = validateStructuredReadingCompleteness({
    sourceText: source,
    editorText: transcript,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, true, `expected pass, got: ${result.reason}`);
});

test("coverage edge mode: FAIL -- a transcript that covers the real opening but genuinely omits the source ending (diverges into unrelated content instead) still fails", () => {
  const source = [ANCHOR_TEST_P1, ANCHOR_TEST_P2, ANCHOR_TEST_P3].join("\n\n");
  const wrongEnding =
    "This part of the lesson also touched briefly on pricing strategy and how a business might adjust its prices seasonally depending on demand throughout the year for various products.";
  // Covers the real beginning (P1) and middle (P2) faithfully, then
  // diverges into unrelated content instead of the real ending (P3) --
  // isolates the ending-coverage check specifically (the beginning check
  // must pass first, or this would fail there instead).
  const transcriptMissingEnding = [
    ANCHOR_TEST_FRAME,
    ANCHOR_TEST_P1,
    ANCHOR_TEST_P2,
    wrongEnding,
  ].join("\n\n");

  const result = validateStructuredReadingCompleteness({
    sourceText: source,
    editorText: transcriptMissingEnding,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ending_content_missing");
});

test("coverage edge mode: the 80% length-ratio safeguard (MIN_COMPLETENESS_RATIO) is completely unchanged", () => {
  const sourceText = [
    "Introduction",
    "Every business must decide whether to target a small specialised market or a broad market depending on customer needs, competition, budget, sales goals and long-term strategy.",
    "Advantages include focused promotion, clearer branding and stronger loyalty.",
    "Disadvantages include limited demand and dependence on fewer customers.",
  ].join("\n");
  const editorText = "Introduction broad market clearer branding.";

  const result = validateStructuredReadingCompleteness({
    sourceText,
    editorText,
    edgeMode: "coverage",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "output_too_short");
});

test("regression: default edgeMode (omitted) is unchanged -- app/api/kingdom/structure-reading's own call keeps the exact literal-anchor behaviour", () => {
  const sourceText = [
    "Topic 3.1: Niche Marketing & Mass Marketing",
    "Learning Block 1 of 1",
    "Sub-topic: Choosing Between Niche and Mass Markets",
    "Introduction",
    "Every business must decide whether to target a small specialised market or a large broad market.",
    "This choice affects pricing, promotion and risk.",
  ].join("\n");
  const editorText = [
    "# Topic 3.1: Niche Marketing & Mass Marketing",
    "## Learning Block 1 of 1",
    "## Sub-topic: Choosing Between Niche and Mass Markets",
    "## Introduction",
    "Every business must decide whether to target a small specialised market or a large broad market. This choice affects pricing, promotion and risk.",
  ].join("\n\n");

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: true,
    reason: "complete",
  });
});

test("completeness fails when output is materially shorter than source", () => {
  const sourceText = [
    "Introduction",
    "Every business must decide whether to target a small specialised market or a broad market depending on customer needs, competition, budget, sales goals and long-term strategy.",
    "Advantages include focused promotion, clearer branding and stronger loyalty.",
    "Disadvantages include limited demand and dependence on fewer customers.",
  ].join("\n");

  const editorText = "Introduction broad market clearer branding.";

  assert.deepEqual(validateStructuredReadingCompleteness({ sourceText, editorText }), {
    ok: false,
    reason: "output_too_short",
  });
});
