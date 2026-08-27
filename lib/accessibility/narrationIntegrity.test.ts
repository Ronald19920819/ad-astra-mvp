import assert from "node:assert/strict";
import test from "node:test";
import { serializeStructuredReading } from "@/lib/readings/structuredReading";
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
