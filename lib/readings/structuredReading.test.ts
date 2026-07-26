import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReadingContent,
  readingContentToPlainText,
  serializeStructuredReading,
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
    /Definition — Labour: The human effort/,
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
