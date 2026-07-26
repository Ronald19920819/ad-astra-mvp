export const STRUCTURED_READING_FORMAT = "ad-astra-structured-reading";

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

function cleanText(value: unknown, maximumLength = 20_000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function cleanItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, 2_000))
    .filter(Boolean)
    .slice(0, 50);
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

  const blocks: StructuredReadingBlock[] = [];

  for (const candidate of document.blocks.slice(0, 200)) {
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
      const items = cleanItems(block.items);
      if (items.length === 0) return null;
      blocks.push({ type: block.type, items });
      continue;
    }

    if (block.type === "definition") {
      const term = cleanText(block.term, 500);
      const definition = cleanText(block.definition, 5_000);
      if (!term || !definition) return null;
      blocks.push({ type: "definition", term, definition });
      continue;
    }

    if (block.type === "table") {
      const headers = cleanItems(block.headers);
      if (headers.length === 0 || !Array.isArray(block.rows)) return null;

      const rows = block.rows
        .slice(0, 50)
        .map((row) => cleanItems(row))
        .filter((row) => row.length === headers.length);

      if (rows.length === 0) return null;
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    return null;
  }

  return blocks.length > 0
    ? {
        format: STRUCTURED_READING_FORMAT,
        version: 1,
        blocks,
      }
    : null;
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

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*•]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*•]\s+/, ""));
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
        /^[-*•]\s+/.test(nextLine) ||
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
        return `Definition — ${block.term}: ${block.definition}`;
      }
      return [
        block.headers.join(" | "),
        ...block.rows.map((row) => row.join(" | ")),
      ].join("\n");
    })
    .join("\n\n");
}
