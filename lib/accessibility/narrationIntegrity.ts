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

// AD Astra readings often open with short structural/navigation labels --
// "Lesson 3.1", "Topic: Market Segmentation", "Subtopic", "Introduction",
// "What You Need to Know" -- that a teacher typed as their own paragraph
// rather than a true heading/subheading block (or that arrived as a
// paragraph because the reading was never run through "Structure with
// Kingdom" at all). The narration rules
// (lib/accessibility/narrationTranscriptPrompt.ts) explicitly license the
// narrator to "transform into natural speech, or omit" exactly this kind
// of technical/navigation label, so a faithful transcript may legitimately
// never say these words verbatim. True heading/subheading BLOCK TYPES are
// already excluded above via SUBSTANTIVE_BLOCK_TYPES; this closes the
// remaining gap for label text that was authored (or classified) as a
// plain paragraph instead.
//
// Only a LEADING run is stripped, and only up to
// MAX_LEADING_LABEL_BLOCKS -- the moment a block doesn't look label-shaped
// (or isn't a paragraph at all, e.g. a list/table/definition), stripping
// stops permanently. This mirrors the same short/unpunctuated heuristic
// already trusted for extractObviousHeadings() in
// lib/readings/structuredReading.ts, applied narrowly so a genuinely
// truncated or wrong-lesson transcript still has real content to fail
// against -- see narrationIntegrity.test.ts for the boundary cases.
const MAX_LEADING_LABEL_BLOCKS = 6;
const LABEL_MAX_WORDS = 12;

function looksLikeStructuralLabel(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  // Real sentences end with terminal punctuation; a navigation label
  // never does ("Lesson 3.1", "Topic: Market Segmentation").
  if (/[.!?;:]$/.test(trimmed)) return false;

  const wordCount = trimmed.split(" ").length;
  return wordCount > 0 && wordCount <= LABEL_MAX_WORDS;
}

function stripLeadingStructuralLabels(
  blocks: StructuredReadingBlock[],
): StructuredReadingBlock[] {
  let skipCount = 0;

  while (
    skipCount < blocks.length &&
    skipCount < MAX_LEADING_LABEL_BLOCKS &&
    blocks[skipCount].type === "paragraph" &&
    looksLikeStructuralLabel((blocks[skipCount] as { text: string }).text)
  ) {
    skipCount += 1;
  }

  return blocks.slice(skipCount);
}

export function buildNarrationValidationSourceText(
  sourceContentText: string | null,
): string {
  const blocks = readingContentToBlocks(sourceContentText);
  const substantiveBlocks = blocks.filter((block) =>
    SUBSTANTIVE_BLOCK_TYPES.has(block.type),
  );

  return stripLeadingStructuralLabels(substantiveBlocks)
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

  // checkHeadings: false -- heading/subheading BLOCKS are already excluded
  // from sourceText above (SUBSTANTIVE_BLOCK_TYPES), and leading
  // structural-label paragraphs are already stripped
  // (stripLeadingStructuralLabels). Re-deriving "heading-shaped" lines
  // from the remaining substantive text (validateStructuredReadingCompleteness's
  // default behaviour, still used as-is by app/api/kingdom/structure-reading's
  // own call) would only rediscover textbook-style labels (e.g. "Example
  // Question", "Model Answer") embedded inside a paragraph/list/
  // definition/table block -- exactly the kind of technical/assessment
  // label the narration rules
  // (lib/accessibility/narrationTranscriptPrompt.ts) explicitly permit the
  // narrator to transform or omit, so requiring it verbatim produced false
  // "heading_missing" rejections of transcripts that had not actually
  // dropped any educational content.
  // edgeMode: "coverage" -- the narration rules
  // (lib/accessibility/narrationTranscriptPrompt.ts) explicitly instruct
  // Kingdom to open with a natural spoken introduction and to paraphrase
  // rather than quote the reading (e.g. its own worked example: "Sub-topic:
  // Trench Warfare" -> "This part of the lesson focuses on trench
  // warfare."), which the default "literal" edge mode's exact 8-word
  // verbatim match cannot tolerate. A real production transcript ("In Part
  // 1 you learned..." narrated as "In the previous part you learned...",
  // after a short spoken introduction) was rejected as
  // beginning_content_missing despite fully covering the reading's actual
  // opening content. "coverage" measures ordered word-overlap within a
  // widened transcript edge window instead -- see
  // validateStructuredReadingCompleteness's own edgeMode doc comment and
  // this file's/structuredReading.test.ts's "coverage edge mode" tests for
  // the calibration evidence.
  const completeness = validateStructuredReadingCompleteness({
    sourceText,
    editorText: transcript,
    checkHeadings: false,
    edgeMode: "coverage",
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
