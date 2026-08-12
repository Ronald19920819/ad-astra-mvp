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
