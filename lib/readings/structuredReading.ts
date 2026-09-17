export const STRUCTURED_READING_FORMAT = "ad-astra-structured-reading";

const MAX_DOCUMENT_BLOCKS = 1_000;
const MAX_TEXT_LENGTH = 60_000;
const MAX_LIST_ITEMS = 250;
const MAX_LIST_ITEM_LENGTH = 10_000;
const MAX_DEFINITION_TERM_LENGTH = 2_000;
const MAX_DEFINITION_TEXT_LENGTH = 60_000;
const MAX_TABLE_ROWS = 250;
const MAX_HEADING_CHECKS = 24;
const MIN_COMPLETENESS_RATIO = 0.8;
const EDGE_WORD_LIMIT = 48;
const EDGE_ANCHOR_COUNT = 4;
const EDGE_ANCHOR_WORDS = 8;
const MIN_ANCHOR_WORDS = 4;

// Narration-specific edge validation ("coverage" edgeMode -- see
// validateStructuredReadingCompleteness below). Accessibility narration is
// explicitly instructed (lib/accessibility/narrationTranscriptPrompt.ts) to
// open with a natural spoken introduction and to paraphrase rather than
// quote the reading verbatim, which the default literal-8-word-anchor edge
// check cannot tolerate. NARRATION_EDGE_SEARCH_MULTIPLIER widens the
// transcript window searched for source-edge coverage beyond the source's
// own EDGE_WORD_LIMIT-word window, so a bounded spoken intro (or closing)
// doesn't push the real content out of range.
// NARRATION_EDGE_COVERAGE_THRESHOLD was derived empirically from paired
// pass/fail examples (a real production transcript plus constructed
// omission/coincidental-overlap cases) -- see
// structuredReading.test.ts/narrationIntegrity.test.ts's "coverage edge
// mode" tests for the exact cases and measured scores that justify 0.6:
// faithful paraphrase examples scored 0.69-0.92, genuine
// omission/coincidental-overlap examples scored 0.10-0.22, a wide margin
// either side of this threshold.
const NARRATION_EDGE_SEARCH_MULTIPLIER = 3;
const NARRATION_EDGE_COVERAGE_THRESHOLD = 0.6;

export type StructuredReadingBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bulletList"; items: string[] }
  | { type: "numberedList"; items: string[] }
  | { type: "definition"; term: string; definition: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type StructuredReadingDocument = {
  format: typeof STRUCTURED_READING_FORMAT;
  version: 1;
  blocks: StructuredReadingBlock[];
};

export type ParsedReadingContent =
  | { kind: "structured"; blocks: StructuredReadingBlock[] }
  | { kind: "plainText"; blocks: StructuredReadingBlock[] }
  | { kind: "malformed"; blocks: [] }
  | { kind: "empty"; blocks: [] };

export type StructuredReadingCompletenessResult = {
  ok: boolean;
  reason: string;
};

function cleanText(value: unknown, maximumLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximumLength) return null;

  return trimmed;
}

function cleanItems(
  value: unknown,
  options: { maximumItems: number; maximumItemLength: number },
) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > options.maximumItems) return null;

  const items: string[] = [];

  for (const item of value) {
    const text = cleanText(item, options.maximumItemLength);
    if (!text) return null;
    items.push(text);
  }

  return items;
}

export function parseStructuredReadingDocument(
  value: unknown,
): StructuredReadingDocument | null {
  if (!value || typeof value !== "object") return null;

  const document = value as Record<string, unknown>;
  if (
    document.format !== STRUCTURED_READING_FORMAT ||
    document.version !== 1 ||
    !Array.isArray(document.blocks)
  ) {
    return null;
  }

  if (document.blocks.length === 0 || document.blocks.length > MAX_DOCUMENT_BLOCKS) {
    return null;
  }

  const blocks: StructuredReadingBlock[] = [];

  for (const candidate of document.blocks) {
    if (!candidate || typeof candidate !== "object") return null;
    const block = candidate as Record<string, unknown>;

    if (
      block.type === "heading" ||
      block.type === "subheading" ||
      block.type === "paragraph"
    ) {
      const text = cleanText(block.text);
      if (!text) return null;
      blocks.push({ type: block.type, text });
      continue;
    }

    if (block.type === "bulletList" || block.type === "numberedList") {
      const items = cleanItems(block.items, {
        maximumItems: MAX_LIST_ITEMS,
        maximumItemLength: MAX_LIST_ITEM_LENGTH,
      });
      if (!items) return null;
      blocks.push({ type: block.type, items });
      continue;
    }

    if (block.type === "definition") {
      const term = cleanText(block.term, MAX_DEFINITION_TERM_LENGTH);
      const definition = cleanText(block.definition, MAX_DEFINITION_TEXT_LENGTH);
      if (!term || !definition) return null;
      blocks.push({ type: "definition", term, definition });
      continue;
    }

    if (block.type === "table") {
      const headers = cleanItems(block.headers, {
        maximumItems: MAX_LIST_ITEMS,
        maximumItemLength: MAX_LIST_ITEM_LENGTH,
      });
      if (!headers || !Array.isArray(block.rows) || block.rows.length === 0) {
        return null;
      }
      if (block.rows.length > MAX_TABLE_ROWS) return null;

      const rows: string[][] = [];
      for (const rowValue of block.rows) {
        const row = cleanItems(rowValue, {
          maximumItems: headers.length,
          maximumItemLength: MAX_LIST_ITEM_LENGTH,
        });
        if (!row || row.length !== headers.length) return null;
        rows.push(row);
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    return null;
  }

  return {
    format: STRUCTURED_READING_FORMAT,
    version: 1,
    blocks,
  };
}

export function parseStructuredReadingJson(
  content: string | null,
): StructuredReadingDocument | null {
  if (!content?.trim().startsWith("{")) return null;

  try {
    return parseStructuredReadingDocument(JSON.parse(content));
  } catch {
    return null;
  }
}

function plainTextBlocks(content: string): StructuredReadingBlock[] {
  return content
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
}

export function parseReadingContent(
  content: string | null,
): ParsedReadingContent {
  const trimmedContent = content?.trim() ?? "";
  if (!trimmedContent) {
    return { kind: "empty", blocks: [] };
  }

  const document = parseStructuredReadingJson(trimmedContent);
  if (document) {
    return { kind: "structured", blocks: document.blocks };
  }

  const looksStructured =
    trimmedContent.includes(STRUCTURED_READING_FORMAT) ||
    (trimmedContent.startsWith("{") &&
      /"(?:format|version|blocks)"\s*:/.test(trimmedContent));

  if (looksStructured) {
    return { kind: "malformed", blocks: [] };
  }

  return {
    kind: "plainText",
    blocks: plainTextBlocks(trimmedContent),
  };
}

export function serializeStructuredReading(
  blocks: StructuredReadingBlock[],
) {
  const document = parseStructuredReadingDocument({
    format: STRUCTURED_READING_FORMAT,
    version: 1,
    blocks,
  });

  if (!document) {
    throw new Error("The reading does not contain valid structured content.");
  }

  return JSON.stringify(document);
}

function splitTableRow(line: string) {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

export function editorTextToStructuredReading(editorText: string) {
  const lines = editorText.replace(/\r\n/g, "\n").split("\n");
  const blocks: StructuredReadingBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "heading", text: line.slice(2).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "subheading", text: line.slice(3).trim() });
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].includes("|")) {
        const row = splitTableRow(lines[index]);
        if (row.length === headers.length) rows.push(row);
        index += 1;
      }

      if (rows.length > 0) {
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    if (/^[-*\u2022]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*\u2022]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*\u2022]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "bulletList", items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^\d+[.)]\s+/.test(lines[index].trim())
      ) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "numberedList", items });
      continue;
    }

    const definitionMatch = line.match(/^([^:\n]{1,120})\s+::\s+(.+)$/);
    if (definitionMatch) {
      blocks.push({
        type: "definition",
        term: definitionMatch[1].trim(),
        definition: definitionMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index].trim();
      if (
        nextLine.startsWith("# ") ||
        nextLine.startsWith("## ") ||
        /^[-*\u2022]\s+/.test(nextLine) ||
        /^\d+[.)]\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return parseStructuredReadingDocument({
    format: STRUCTURED_READING_FORMAT,
    version: 1,
    blocks,
  });
}

export function structuredReadingToEditorText(
  document: StructuredReadingDocument,
) {
  return document.blocks
    .map((block) => {
      if (block.type === "heading") return `# ${block.text}`;
      if (block.type === "subheading") return `## ${block.text}`;
      if (block.type === "paragraph") return block.text;
      if (block.type === "bulletList") {
        return block.items.map((item) => `- ${item}`).join("\n");
      }
      if (block.type === "numberedList") {
        return block.items
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n");
      }
      if (block.type === "definition") {
        return `${block.term} :: ${block.definition}`;
      }

      const header = `| ${block.headers.join(" | ")} |`;
      const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n");
      return `${header}\n${divider}\n${rows}`;
    })
    .join("\n\n");
}

function normalizeCompletenessText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[	 ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForContainment(value: string) {
  return normalizeCompletenessText(value)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*\u2022]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/[|`>]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractMeaningfulWords(value: string) {
  return normalizeForContainment(value)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function buildEdgeAnchors(
  words: string[],
  position: "start" | "end",
) {
  if (words.length === 0) return [];

  const edgeWords =
    position === "start"
      ? words.slice(0, EDGE_WORD_LIMIT)
      : words.slice(-EDGE_WORD_LIMIT);

  if (edgeWords.length === 0) return [];

  const anchors: string[] = [];
  const anchorWordCount = Math.max(
    MIN_ANCHOR_WORDS,
    Math.min(EDGE_ANCHOR_WORDS, edgeWords.length),
  );

  if (edgeWords.length <= anchorWordCount) {
    return [edgeWords.join(" ")];
  }

  const lastPossibleStart = edgeWords.length - anchorWordCount;
  const divisor = Math.max(1, EDGE_ANCHOR_COUNT - 1);

  for (let index = 0; index < EDGE_ANCHOR_COUNT; index += 1) {
    const start = Math.min(
      lastPossibleStart,
      Math.floor((lastPossibleStart * index) / divisor),
    );
    const anchor = edgeWords.slice(start, start + anchorWordCount).join(" ");
    if (anchor && !anchors.includes(anchor)) {
      anchors.push(anchor);
    }
  }

  return anchors;
}

function countOrderedAnchorMatches(output: string, anchors: string[]) {
  let fromIndex = 0;
  let matched = 0;

  for (const anchor of anchors) {
    const index = output.indexOf(anchor, fromIndex);
    if (index === -1) continue;

    matched += 1;
    fromIndex = index + anchor.length;
  }

  return matched;
}

function requiredAnchorMatches(anchorCount: number) {
  return Math.max(1, Math.ceil(anchorCount * 0.75));
}

// Longest common subsequence length -- deterministic, purely lexical
// (no AI/embeddings/fuzzy matching), tolerates paraphrasing because it
// only requires the source's own words to reappear in the same relative
// ORDER, not as one exact contiguous phrase: insertions, substitutions,
// and reorderings in between still let the shared words line up. Single-
// row DP (standard technique), safe here since both inputs are bounded to
// at most a few hundred words by the edge-window slicing in
// computeNarrationEdgeCoverage below.
function lcsLength(a: string[], b: string[]): number {
  const row = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    let previousDiagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const previousRowValue = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? previousDiagonal + 1
          : Math.max(row[j], row[j - 1]);
      previousDiagonal = previousRowValue;
    }
  }

  return row[b.length];
}

// Narration-specific ("coverage" edgeMode) replacement for the literal
// 8-word-anchor check: what fraction of the source's own edge-window words
// (in order, not necessarily contiguous) reappear inside a correspondingly
// widened transcript edge window. Deliberately widens the transcript side
// (NARRATION_EDGE_SEARCH_MULTIPLIER) rather than the source side, so a
// bounded spoken introduction/closing before/after the real content is
// tolerated without weakening what source content must actually be
// present.
function computeNarrationEdgeCoverage(
  sourceWords: string[],
  transcriptWords: string[],
  position: "start" | "end",
): number {
  const sourceEdge =
    position === "start"
      ? sourceWords.slice(0, EDGE_WORD_LIMIT)
      : sourceWords.slice(-EDGE_WORD_LIMIT);
  if (sourceEdge.length === 0) return 1;

  const searchLimit = EDGE_WORD_LIMIT * NARRATION_EDGE_SEARCH_MULTIPLIER;
  const transcriptWindow =
    position === "start"
      ? transcriptWords.slice(0, searchLimit)
      : transcriptWords.slice(-searchLimit);

  return lcsLength(sourceEdge, transcriptWindow) / sourceEdge.length;
}

function extractObviousHeadings(sourceText: string) {
  return Array.from(
    new Set(
      normalizeCompletenessText(sourceText)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length >= 3 && line.length <= 120)
        .filter((line) => !line.includes("|"))
        .filter((line) => !/^[-*\u2022]\s+/.test(line))
        .filter((line) => !/^\d+[.)]\s+/.test(line))
        .filter((line) => !/[.!?;:]$/.test(line))
        .filter((line) => line.split(/\s+/).length <= 12)
        .map((line) => line.replace(/^#+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, MAX_HEADING_CHECKS),
    ),
  );
}

export function validateStructuredReadingCompleteness({
  sourceText,
  editorText,
  checkHeadings = true,
  edgeMode = "literal",
}: {
  sourceText: string;
  editorText: string;
  // extractObviousHeadings() re-derives "heading-shaped" lines (short,
  // unpunctuated, title-like) directly from sourceText -- it has no
  // awareness of which lines came from a real heading/subheading block
  // versus a structural/decorative label embedded inside an already-
  // classified substantive block (paragraph/list/definition/table). For
  // app/api/kingdom/structure-reading/route.ts (the default, checkHeadings
  // left true) sourceText is the teacher's raw, unfiltered original text
  // and editorText legitimately renders real heading/subheading lines
  // (structuredReadingToEditorText emits "# .../## ..."), so this check
  // does genuine, needed work there: catching a heading Kingdom's
  // structuring silently dropped. For narration validation
  // (lib/accessibility/narrationIntegrity.ts), sourceText has already had
  // heading/subheading BLOCKS excluded and leading structural-label
  // blocks stripped before it ever reaches this function -- a caller that
  // has already done its own block-type-based heading handling should set
  // this to false, since re-scanning the remaining substantive text for
  // heading-SHAPED lines only rediscovers embedded labels the narration
  // rules explicitly permit the narrator to transform or omit, causing a
  // false "heading_missing" rejection of a transcript that has not
  // actually dropped any educational content.
  checkHeadings?: boolean;
  // "literal" (default, unchanged) requires an exact, ordered 8-word
  // source phrase to appear verbatim in the output -- correct for
  // app/api/kingdom/structure-reading/route.ts, whose editorText is
  // expected to preserve the teacher's own wording closely. Accessibility
  // narration (lib/accessibility/narrationIntegrity.ts) is explicitly
  // instructed to open with a natural spoken introduction and to
  // paraphrase rather than quote the reading
  // (lib/accessibility/narrationTranscriptPrompt.ts), which a literal
  // 8-word match cannot tolerate -- a faithful, complete transcript that
  // (correctly) never repeats the source's exact opening/closing wording
  // was being rejected as beginning/ending_content_missing. "coverage"
  // instead measures what fraction of the source's own edge-window words
  // reappear, in order, inside a correspondingly widened transcript edge
  // window (computeNarrationEdgeCoverage) -- tolerant of paraphrasing and
  // of a bounded leading/trailing spoken framing, while still failing a
  // genuine omission or a transcript that only coincidentally shares a
  // handful of common words with the source (see this file's and
  // narrationIntegrity.test.ts's "coverage edge mode" tests for the
  // calibration cases).
  edgeMode?: "literal" | "coverage";
}): StructuredReadingCompletenessResult {
  const normalizedSource = normalizeForContainment(sourceText);
  const normalizedOutput = normalizeForContainment(editorText);

  if (!normalizedSource || !normalizedOutput) {
    return {
      ok: false,
      reason: "missing_normalized_content",
    };
  }

  if (normalizedOutput.length < normalizedSource.length * MIN_COMPLETENESS_RATIO) {
    return {
      ok: false,
      reason: "output_too_short",
    };
  }

  if (edgeMode === "coverage") {
    const sourceWords = extractMeaningfulWords(sourceText);
    const transcriptWords = extractMeaningfulWords(editorText);

    const beginningCoverage = computeNarrationEdgeCoverage(
      sourceWords,
      transcriptWords,
      "start",
    );
    if (beginningCoverage < NARRATION_EDGE_COVERAGE_THRESHOLD) {
      return {
        ok: false,
        reason: "beginning_content_missing",
      };
    }

    const endingCoverage = computeNarrationEdgeCoverage(
      sourceWords,
      transcriptWords,
      "end",
    );
    if (endingCoverage < NARRATION_EDGE_COVERAGE_THRESHOLD) {
      return {
        ok: false,
        reason: "ending_content_missing",
      };
    }
  } else {
    const beginningAnchors = buildEdgeAnchors(
      extractMeaningfulWords(sourceText),
      "start",
    );
    const beginningMatches = countOrderedAnchorMatches(
      normalizedOutput,
      beginningAnchors,
    );
    if (
      beginningAnchors.length > 0 &&
      beginningMatches < requiredAnchorMatches(beginningAnchors.length)
    ) {
      return {
        ok: false,
        reason: "beginning_content_missing",
      };
    }

    const endingAnchors = buildEdgeAnchors(
      extractMeaningfulWords(sourceText),
      "end",
    );
    const endingMatches = countOrderedAnchorMatches(
      normalizedOutput,
      endingAnchors,
    );
    if (
      endingAnchors.length > 0 &&
      endingMatches < requiredAnchorMatches(endingAnchors.length)
    ) {
      return {
        ok: false,
        reason: "ending_content_missing",
      };
    }
  }

  if (checkHeadings) {
    const headings = extractObviousHeadings(sourceText);
    const missingHeadings = headings.filter((heading) => {
      const normalizedHeading = normalizeForContainment(heading);
      return normalizedHeading && !normalizedOutput.includes(normalizedHeading);
    });

    if (missingHeadings.length > 0) {
      return {
        ok: false,
        reason: "heading_missing",
      };
    }
  }

  return {
    ok: true,
    reason: "complete",
  };
}

export function readingContentToEditorText(content: string | null) {
  const document = parseStructuredReadingJson(content);
  return document ? structuredReadingToEditorText(document) : (content ?? "");
}

export function readingContentToBlocks(
  content: string | null,
): StructuredReadingBlock[] {
  return parseReadingContent(content).blocks;
}

export function readingContentToPlainText(content: string | null) {
  const parsed = parseReadingContent(content);
  if (parsed.kind === "malformed" || parsed.kind === "empty") return "";

  return parsed.blocks
    .map((block) => {
      if (block.type === "heading") return `Heading: ${block.text}`;
      if (block.type === "subheading") return `Subheading: ${block.text}`;
      if (block.type === "paragraph") return block.text;
      if (block.type === "bulletList") {
        return block.items.map((item) => `- ${item}`).join("\n");
      }
      if (block.type === "numberedList") {
        return block.items
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n");
      }
      if (block.type === "definition") {
        return `Definition - ${block.term}: ${block.definition}`;
      }
      return [
        block.headers.join(" | "),
        ...block.rows.map((row) => row.join(" | ")),
      ].join("\n");
    })
    .join("\n\n");
}
