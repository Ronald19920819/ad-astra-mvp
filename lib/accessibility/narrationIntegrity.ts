import {
  readingContentToBlocks,
  validateStructuredReadingCompleteness,
  type StructuredReadingBlock,
} from "@/lib/readings/structuredReading";

export type NarrationValidationResult = {
  ok: boolean;
  reason: string;
};

const MIN_TRANSCRIPT_LENGTH = 40;

// The narration rules (lib/accessibility/narrationTranscriptPrompt.ts)
// deliberately require headings/subheadings to be TRANSFORMED into natural
// spoken transitions -- never read as "Heading colon..." -- so a strict
// verbatim-preservation check must exclude them, or every correctly
// narrated transcript would fail for legitimately not repeating heading
// text verbatim. Every genuinely substantive content block (the actual
// curriculum content: paragraphs, lists, definitions, tables) is still
// included and checked for faithful preservation.
const SUBSTANTIVE_BLOCK_TYPES: ReadonlySet<StructuredReadingBlock["type"]> = new Set([
  "paragraph",
  "bulletList",
  "numberedList",
  "definition",
  "table",
]);

function blockToText(block: StructuredReadingBlock): string {
  if (block.type === "paragraph") return block.text;
  if (block.type === "bulletList" || block.type === "numberedList") {
    return block.items.join("\n");
  }
  if (block.type === "definition") return `${block.term}: ${block.definition}`;
  if (block.type === "table") {
    return [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))].join("\n");
  }
  return "";
}

export function buildNarrationValidationSourceText(
  sourceContentText: string | null,
): string {
  const blocks = readingContentToBlocks(sourceContentText);
  return blocks
    .filter((block) => SUBSTANTIVE_BLOCK_TYPES.has(block.type))
    .map(blockToText)
    .join("\n\n");
}

function describeCompletenessFailure(reason: string) {
  switch (reason) {
    case "output_too_short":
      return "The narration transcript looks shorter than the original reading and may have dropped content.";
    case "beginning_content_missing":
      return "The narration transcript does not appear to cover the start of the reading.";
    case "ending_content_missing":
      return "The narration transcript does not appear to cover the end of the reading.";
    case "heading_missing":
      return "The narration transcript appears to be missing a section of the reading.";
    default:
      return "The narration transcript could not be verified against the original reading.";
  }
}

// pasted_text readings have a clean ground-truth structured source
// (StructuredReadingDocument), so this reuses the exact same anchor
// completeness check already trusted for Kingdom's "Structure with
// Kingdom" reading tool (lib/readings/structuredReading.ts, exercised by
// app/api/kingdom/structure-reading/route.ts) -- never a second,
// independently-invented completeness algorithm -- applied to the
// heading-excluded substantive content only (see
// buildNarrationValidationSourceText above).
export function validatePastedTextNarration(args: {
  sourceContentText: string;
  transcript: string;
}): NarrationValidationResult {
  const transcript = args.transcript.trim();
  if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return {
      ok: false,
      reason: "The narration transcript is empty or too short.",
    };
  }

  const sourceText = buildNarrationValidationSourceText(args.sourceContentText);
  if (!sourceText.trim()) {
    return {
      ok: false,
      reason: "The saved reading has no content to narrate.",
    };
  }

  const completeness = validateStructuredReadingCompleteness({
    sourceText,
    editorText: transcript,
  });

  if (!completeness.ok) {
    return { ok: false, reason: describeCompletenessFailure(completeness.reason) };
  }

  return { ok: true, reason: "complete" };
}

// PDF readings have no extracted ground-truth text anywhere in this app
// (lib/kingdom/lessonReadingGeneration.ts deliberately hands the PDF file
// itself to OpenAI rather than extracting text -- see Stage-B's
// investigation report). There is therefore no deterministic text to run
// the same anchor comparison against. This is a narrower, best-effort
// structural check, not a true completeness comparison -- a disclosed,
// known limitation of PDF-sourced narration in v1.
export function validatePdfNarration(args: {
  transcript: string;
}): NarrationValidationResult {
  const transcript = args.transcript.trim();
  if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return {
      ok: false,
      reason: "The narration transcript is empty or too short.",
    };
  }

  return { ok: true, reason: "complete" };
}

export function validateAccessibilityNarration(args: {
  sourceType: "pasted_text" | "pdf";
  sourceContentText: string | null;
  transcript: string;
}): NarrationValidationResult {
  if (args.sourceType === "pasted_text") {
    return validatePastedTextNarration({
      sourceContentText: args.sourceContentText ?? "",
      transcript: args.transcript,
    });
  }
  return validatePdfNarration({ transcript: args.transcript });
}
