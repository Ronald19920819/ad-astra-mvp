"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRUCTURED_READING_FORMAT = void 0;
exports.parseStructuredReadingDocument = parseStructuredReadingDocument;
exports.parseStructuredReadingJson = parseStructuredReadingJson;
exports.parseReadingContent = parseReadingContent;
exports.serializeStructuredReading = serializeStructuredReading;
exports.editorTextToStructuredReading = editorTextToStructuredReading;
exports.structuredReadingToEditorText = structuredReadingToEditorText;
exports.validateStructuredReadingCompleteness = validateStructuredReadingCompleteness;
exports.readingContentToEditorText = readingContentToEditorText;
exports.readingContentToBlocks = readingContentToBlocks;
exports.readingContentToPlainText = readingContentToPlainText;
exports.STRUCTURED_READING_FORMAT = "ad-astra-structured-reading";
const MAX_DOCUMENT_BLOCKS = 1000;
const MAX_TEXT_LENGTH = 60000;
const MAX_LIST_ITEMS = 250;
const MAX_LIST_ITEM_LENGTH = 10000;
const MAX_DEFINITION_TERM_LENGTH = 2000;
const MAX_DEFINITION_TEXT_LENGTH = 60000;
const MAX_TABLE_ROWS = 250;
const MAX_HEADING_CHECKS = 24;
const MIN_COMPLETENESS_RATIO = 0.8;
const EDGE_WORD_LIMIT = 48;
const EDGE_ANCHOR_COUNT = 4;
const EDGE_ANCHOR_WORDS = 8;
const MIN_ANCHOR_WORDS = 4;
function cleanText(value, maximumLength = MAX_TEXT_LENGTH) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maximumLength)
        return null;
    return trimmed;
}
function cleanItems(value, options) {
    if (!Array.isArray(value) || value.length === 0)
        return null;
    if (value.length > options.maximumItems)
        return null;
    const items = [];
    for (const item of value) {
        const text = cleanText(item, options.maximumItemLength);
        if (!text)
            return null;
        items.push(text);
    }
    return items;
}
function parseStructuredReadingDocument(value) {
    if (!value || typeof value !== "object")
        return null;
    const document = value;
    if (document.format !== exports.STRUCTURED_READING_FORMAT ||
        document.version !== 1 ||
        !Array.isArray(document.blocks)) {
        return null;
    }
    if (document.blocks.length === 0 || document.blocks.length > MAX_DOCUMENT_BLOCKS) {
        return null;
    }
    const blocks = [];
    for (const candidate of document.blocks) {
        if (!candidate || typeof candidate !== "object")
            return null;
        const block = candidate;
        if (block.type === "heading" ||
            block.type === "subheading" ||
            block.type === "paragraph") {
            const text = cleanText(block.text);
            if (!text)
                return null;
            blocks.push({ type: block.type, text });
            continue;
        }
        if (block.type === "bulletList" || block.type === "numberedList") {
            const items = cleanItems(block.items, {
                maximumItems: MAX_LIST_ITEMS,
                maximumItemLength: MAX_LIST_ITEM_LENGTH,
            });
            if (!items)
                return null;
            blocks.push({ type: block.type, items });
            continue;
        }
        if (block.type === "definition") {
            const term = cleanText(block.term, MAX_DEFINITION_TERM_LENGTH);
            const definition = cleanText(block.definition, MAX_DEFINITION_TEXT_LENGTH);
            if (!term || !definition)
                return null;
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
            if (block.rows.length > MAX_TABLE_ROWS)
                return null;
            const rows = [];
            for (const rowValue of block.rows) {
                const row = cleanItems(rowValue, {
                    maximumItems: headers.length,
                    maximumItemLength: MAX_LIST_ITEM_LENGTH,
                });
                if (!row || row.length !== headers.length)
                    return null;
                rows.push(row);
            }
            blocks.push({ type: "table", headers, rows });
            continue;
        }
        return null;
    }
    return {
        format: exports.STRUCTURED_READING_FORMAT,
        version: 1,
        blocks,
    };
}
function parseStructuredReadingJson(content) {
    if (!content?.trim().startsWith("{"))
        return null;
    try {
        return parseStructuredReadingDocument(JSON.parse(content));
    }
    catch {
        return null;
    }
}
function plainTextBlocks(content) {
    return content
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ type: "paragraph", text }));
}
function parseReadingContent(content) {
    const trimmedContent = content?.trim() ?? "";
    if (!trimmedContent) {
        return { kind: "empty", blocks: [] };
    }
    const document = parseStructuredReadingJson(trimmedContent);
    if (document) {
        return { kind: "structured", blocks: document.blocks };
    }
    const looksStructured = trimmedContent.includes(exports.STRUCTURED_READING_FORMAT) ||
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
function serializeStructuredReading(blocks) {
    const document = parseStructuredReadingDocument({
        format: exports.STRUCTURED_READING_FORMAT,
        version: 1,
        blocks,
    });
    if (!document) {
        throw new Error("The reading does not contain valid structured content.");
    }
    return JSON.stringify(document);
}
function splitTableRow(line) {
    return line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((cell) => cell.trim());
}
function isTableDivider(line) {
    const cells = splitTableRow(line);
    return (cells.length > 0 &&
        cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}
function editorTextToStructuredReading(editorText) {
    const lines = editorText.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
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
        if (line.includes("|") &&
            index + 1 < lines.length &&
            isTableDivider(lines[index + 1])) {
            const headers = splitTableRow(line);
            const rows = [];
            index += 2;
            while (index < lines.length && lines[index].includes("|")) {
                const row = splitTableRow(lines[index]);
                if (row.length === headers.length)
                    rows.push(row);
                index += 1;
            }
            if (rows.length > 0) {
                blocks.push({ type: "table", headers, rows });
            }
            continue;
        }
        if (/^[-*\u2022]\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^[-*\u2022]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*\u2022]\s+/, ""));
                index += 1;
            }
            blocks.push({ type: "bulletList", items });
            continue;
        }
        if (/^\d+[.)]\s+/.test(line)) {
            const items = [];
            while (index < lines.length &&
                /^\d+[.)]\s+/.test(lines[index].trim())) {
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
            if (nextLine.startsWith("# ") ||
                nextLine.startsWith("## ") ||
                /^[-*\u2022]\s+/.test(nextLine) ||
                /^\d+[.)]\s+/.test(nextLine)) {
                break;
            }
            paragraphLines.push(nextLine);
            index += 1;
        }
        blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    }
    return parseStructuredReadingDocument({
        format: exports.STRUCTURED_READING_FORMAT,
        version: 1,
        blocks,
    });
}
function structuredReadingToEditorText(document) {
    return document.blocks
        .map((block) => {
        if (block.type === "heading")
            return `# ${block.text}`;
        if (block.type === "subheading")
            return `## ${block.text}`;
        if (block.type === "paragraph")
            return block.text;
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
function normalizeCompletenessText(value) {
    return value
        .normalize("NFKC")
        .replace(/\r\n/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/[	 ]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function normalizeForContainment(value) {
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
function extractMeaningfulWords(value) {
    return normalizeForContainment(value)
        .split(" ")
        .map((word) => word.trim())
        .filter((word) => word.length > 0);
}
function buildEdgeAnchors(words, position) {
    if (words.length === 0)
        return [];
    const edgeWords = position === "start"
        ? words.slice(0, EDGE_WORD_LIMIT)
        : words.slice(-EDGE_WORD_LIMIT);
    if (edgeWords.length === 0)
        return [];
    const anchors = [];
    const anchorWordCount = Math.max(MIN_ANCHOR_WORDS, Math.min(EDGE_ANCHOR_WORDS, edgeWords.length));
    if (edgeWords.length <= anchorWordCount) {
        return [edgeWords.join(" ")];
    }
    const lastPossibleStart = edgeWords.length - anchorWordCount;
    const divisor = Math.max(1, EDGE_ANCHOR_COUNT - 1);
    for (let index = 0; index < EDGE_ANCHOR_COUNT; index += 1) {
        const start = Math.min(lastPossibleStart, Math.floor((lastPossibleStart * index) / divisor));
        const anchor = edgeWords.slice(start, start + anchorWordCount).join(" ");
        if (anchor && !anchors.includes(anchor)) {
            anchors.push(anchor);
        }
    }
    return anchors;
}
function countOrderedAnchorMatches(output, anchors) {
    let fromIndex = 0;
    let matched = 0;
    for (const anchor of anchors) {
        const index = output.indexOf(anchor, fromIndex);
        if (index === -1)
            continue;
        matched += 1;
        fromIndex = index + anchor.length;
    }
    return matched;
}
function requiredAnchorMatches(anchorCount) {
    return Math.max(1, Math.ceil(anchorCount * 0.75));
}
function extractObviousHeadings(sourceText) {
    return Array.from(new Set(normalizeCompletenessText(sourceText)
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
        .slice(0, MAX_HEADING_CHECKS)));
}
function validateStructuredReadingCompleteness({ sourceText, editorText, }) {
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
    const beginningAnchors = buildEdgeAnchors(extractMeaningfulWords(sourceText), "start");
    const beginningMatches = countOrderedAnchorMatches(normalizedOutput, beginningAnchors);
    if (beginningAnchors.length > 0 &&
        beginningMatches < requiredAnchorMatches(beginningAnchors.length)) {
        return {
            ok: false,
            reason: "beginning_content_missing",
        };
    }
    const endingAnchors = buildEdgeAnchors(extractMeaningfulWords(sourceText), "end");
    const endingMatches = countOrderedAnchorMatches(normalizedOutput, endingAnchors);
    if (endingAnchors.length > 0 &&
        endingMatches < requiredAnchorMatches(endingAnchors.length)) {
        return {
            ok: false,
            reason: "ending_content_missing",
        };
    }
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
    return {
        ok: true,
        reason: "complete",
    };
}
function readingContentToEditorText(content) {
    const document = parseStructuredReadingJson(content);
    return document ? structuredReadingToEditorText(document) : (content ?? "");
}
function readingContentToBlocks(content) {
    return parseReadingContent(content).blocks;
}
function readingContentToPlainText(content) {
    const parsed = parseReadingContent(content);
    if (parsed.kind === "malformed" || parsed.kind === "empty")
        return "";
    return parsed.blocks
        .map((block) => {
        if (block.type === "heading")
            return `Heading: ${block.text}`;
        if (block.type === "subheading")
            return `Subheading: ${block.text}`;
        if (block.type === "paragraph")
            return block.text;
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
