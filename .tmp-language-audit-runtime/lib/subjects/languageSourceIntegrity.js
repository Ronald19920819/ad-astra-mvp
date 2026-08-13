"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLanguageSubjectKey = isLanguageSubjectKey;
exports.questionRequiresSourceEvidence = questionRequiresSourceEvidence;
exports.classifyReadingSourceMaterial = classifyReadingSourceMaterial;
exports.lessonRequiresSubstantialSourceMaterial = lessonRequiresSubstantialSourceMaterial;
exports.hasSufficientEvidenceForQuestion = hasSufficientEvidenceForQuestion;
exports.buildLanguageReadingSourceIntegrityPrompt = buildLanguageReadingSourceIntegrityPrompt;
exports.buildLanguageActivitySourceIntegrityPrompt = buildLanguageActivitySourceIntegrityPrompt;
const structuredReading_1 = require("../readings/structuredReading");
const LANGUAGE_SUBJECT_KEYS = new Set([
    "english",
    "english-stage-8",
    "afrikaans",
    "afrikaans-stage-8",
]);
const ALWAYS_SOURCE_ENGLISH_QUESTION_TYPES = new Set([
    "language-analysis",
    "interpretation",
]);
const ALWAYS_SOURCE_AFRIKAANS_QUESTION_TYPES = new Set([
    "taal-en-toon",
]);
const ENGLISH_SOURCE_LABEL_PATTERN = /\b(teaching extract|practice extract|extract|passage|poem|dialogue|story|article|speech|letter|text|example)\b/i;
const AFRIKAANS_SOURCE_LABEL_PATTERN = /\b(voorbeeld|uittreksel|teks|gedig|dialoog|drama-uittreksel|verhaal)\b/i;
const TEACHING_LABEL_PATTERN = /\b(let'?s analyse it|what the example shows|teaching explanation|summary|key takeaways|definisie|kom ons ontleed dit|wat die voorbeeld wys|opsomming)\b/i;
const ENGLISH_EVIDENCE_PATTERN = /\b(from the extract|from the text|from the passage|quote|quotation|quoted|textual evidence|evidence from the (?:extract|text|passage|story|poem)|words? or phrases?|writer'?s language|effect on the reader|structure of the extract|identify (?:two )?examples? from the (?:extract|text)|compare the two texts?|compare the writers'? perspectives?)\b/i;
const AFRIKAANS_EVIDENCE_PATTERN = /\b(uit die uittreksel|uit die teks|haal aan|aanhaling|teksbewyse|bewyse uit die teks|woorde? of frases?|taalgebruik|verwys na die teks|beeldspraak|toon|stemming|struktuur|vergelyk die tekste|identifiseer (?:twee )?voorbeelde?)\b/i;
const ENGLISH_ANALYTICAL_SKILL_PATTERN = /\b(language analysis|writer'?s (?:choices|language)|effect on the reader|narrative technique|narrative techniques|structural analysis|structure|tone|mood|imagery|figurative language|poetry|drama|characterisation|compare(?:\s+the)?\s+two\s+texts?|compare perspectives|evidence selection|quotation-based analysis|textual analysis|non-linear narrative|suspense)\b/i;
const AFRIKAANS_ANALYTICAL_SKILL_PATTERN = /\b(beeldspraak|taalgebruik|toon|stemming|struktuur|karakterisering|poesie|poësie|drama|verhaaltegnieke|teksanalise|bewyse|haal aan|uittreksel|vergelyk die tekste)\b/i;
const SOURCE_PREFIX_PATTERNS = {
    english: /^(Teaching Extract|Practice Extract|Extract|Passage|Poem|Dialogue|Story|Article|Speech|Letter|Text|Example)\s*:\s*(.*)$/i,
    afrikaans: /^(Voorbeeld|Uittreksel|Teks|Gedig|Dialoog|Drama-uittreksel|Verhaal)\s*:\s*(.*)$/i,
};
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function countWords(value) {
    const matches = normalizeWhitespace(value).match(/[A-Za-zÀ-ÿ']+/g);
    return matches?.length ?? 0;
}
function countCandidateEvidenceUnits(value) {
    return value
        .split(/(?<=[.!?])\s+|\n+/)
        .map((unit) => normalizeWhitespace(unit))
        .filter((unit) => countWords(unit) >= 4).length;
}
function blockToText(block) {
    if (block.type === "heading" ||
        block.type === "subheading" ||
        block.type === "paragraph") {
        return block.text;
    }
    if (block.type === "bulletList" || block.type === "numberedList") {
        return block.items.join("\n");
    }
    if (block.type === "definition") {
        return `${block.term}: ${block.definition}`;
    }
    return [
        block.headers.join(" | "),
        ...block.rows.map((row) => row.join(" | ")),
    ].join("\n");
}
function isAfrikaansSubjectKey(subjectKey) {
    return subjectKey === "afrikaans" || subjectKey === "afrikaans-stage-8";
}
function isEnglishSubjectKey(subjectKey) {
    return subjectKey === "english" || subjectKey === "english-stage-8";
}
function isSourceLabel(subjectKey, label) {
    if (!label)
        return false;
    return isAfrikaansSubjectKey(subjectKey)
        ? AFRIKAANS_SOURCE_LABEL_PATTERN.test(label)
        : ENGLISH_SOURCE_LABEL_PATTERN.test(label);
}
function blockLooksLikeDialogueOrVerse(text) {
    return /["“”]/.test(text);
}
function classifySegment(subjectKey, label, text) {
    const normalizedText = text.trim();
    const wordCount = countWords(normalizedText);
    const candidateEvidenceCount = countCandidateEvidenceUnits(normalizedText);
    const labelledSource = isSourceLabel(subjectKey, label);
    const teachingLabel = label ? TEACHING_LABEL_PATTERN.test(label) : false;
    const dialogueOrVerse = blockLooksLikeDialogueOrVerse(normalizedText);
    let kind = "teaching-prose";
    if (labelledSource) {
        kind =
            wordCount >= 35 && candidateEvidenceCount >= 2
                ? "substantial-source"
                : "short-illustrative-example";
    }
    else if (!teachingLabel && dialogueOrVerse && wordCount >= 60) {
        kind = "substantial-source";
    }
    else if (wordCount > 0 && wordCount <= 35 && candidateEvidenceCount <= 1) {
        kind = "short-illustrative-example";
    }
    return {
        label,
        text: normalizedText,
        wordCount,
        candidateEvidenceCount,
        kind,
    };
}
function buildSegments(blocks, subjectKey) {
    const segments = [];
    let currentLabel = null;
    let currentParts = [];
    const sourcePrefixPattern = isAfrikaansSubjectKey(subjectKey)
        ? SOURCE_PREFIX_PATTERNS.afrikaans
        : SOURCE_PREFIX_PATTERNS.english;
    const pushCurrent = () => {
        const text = currentParts.join("\n\n").trim();
        if (!text)
            return;
        segments.push(classifySegment(subjectKey, currentLabel, text));
    };
    for (const block of blocks) {
        if (block.type === "heading" || block.type === "subheading") {
            pushCurrent();
            currentLabel = block.text;
            currentParts = [];
            continue;
        }
        const blockText = blockToText(block);
        const headingMatch = block.type === "paragraph"
            ? blockText.match(/^(Heading|Subheading):\s*(.+)$/i)
            : null;
        if (headingMatch) {
            pushCurrent();
            currentLabel = headingMatch[2].trim();
            currentParts = [];
            continue;
        }
        const sourcePrefixMatch = block.type === "paragraph" ? blockText.match(sourcePrefixPattern) : null;
        if (sourcePrefixMatch) {
            pushCurrent();
            currentLabel = sourcePrefixMatch[1].trim();
            currentParts = sourcePrefixMatch[2].trim()
                ? [sourcePrefixMatch[2].trim()]
                : [];
            continue;
        }
        currentParts.push(blockText);
    }
    pushCurrent();
    if (segments.length > 0) {
        return segments;
    }
    const fallbackText = blocks.map((block) => blockToText(block)).join("\n\n").trim();
    return fallbackText ? [classifySegment(subjectKey, null, fallbackText)] : [];
}
function isLanguageSubjectKey(subjectKey) {
    return LANGUAGE_SUBJECT_KEYS.has(subjectKey);
}
function questionRequiresSourceEvidence({ subjectKey, questionText, questionType, }) {
    const normalizedQuestion = normalizeWhitespace(questionText);
    if (isEnglishSubjectKey(subjectKey)) {
        if (questionType && ALWAYS_SOURCE_ENGLISH_QUESTION_TYPES.has(questionType)) {
            return true;
        }
        return ENGLISH_EVIDENCE_PATTERN.test(normalizedQuestion);
    }
    if (isAfrikaansSubjectKey(subjectKey)) {
        if (questionType && ALWAYS_SOURCE_AFRIKAANS_QUESTION_TYPES.has(questionType)) {
            return true;
        }
        return AFRIKAANS_EVIDENCE_PATTERN.test(normalizedQuestion);
    }
    return false;
}
function classifyReadingSourceMaterial(readingContent, subjectKey) {
    const segments = buildSegments((0, structuredReading_1.readingContentToBlocks)(readingContent), subjectKey);
    const substantialSourceCount = segments.filter((segment) => segment.kind === "substantial-source").length;
    const shortExampleCount = segments.filter((segment) => segment.kind === "short-illustrative-example").length;
    const teachingProseCount = segments.filter((segment) => segment.kind === "teaching-prose").length;
    const totalCandidateEvidenceCount = segments
        .filter((segment) => segment.kind === "substantial-source")
        .reduce((total, segment) => total + segment.candidateEvidenceCount, 0);
    return {
        overallKind: substantialSourceCount > 0
            ? "substantial-source"
            : shortExampleCount > 0
                ? "short-illustrative-example"
                : "teaching-prose",
        segments,
        substantialSourceCount,
        shortExampleCount,
        teachingProseCount,
        totalCandidateEvidenceCount,
        supportsIndependentPractice: substantialSourceCount > 0 && totalCandidateEvidenceCount >= 2,
    };
}
function lessonRequiresSubstantialSourceMaterial(args) {
    if (!isLanguageSubjectKey(args.subjectKey)) {
        return false;
    }
    const combined = normalizeWhitespace(`${args.readingTitle} ${args.instruction}`);
    return isAfrikaansSubjectKey(args.subjectKey)
        ? AFRIKAANS_ANALYTICAL_SKILL_PATTERN.test(combined)
        : ENGLISH_ANALYTICAL_SKILL_PATTERN.test(combined);
}
function requiresTwoTexts(question) {
    return /\b(compare (?:the )?two texts?|two writers'? perspectives?)\b/i.test(question) ||
        /\b(vergelyk die tekste|vergelyk die twee tekste)\b/i.test(question);
}
function requiresTwoExamples(question) {
    return /\b(two|2)\b/i.test(question) || /\b(twee|2)\b/i.test(question);
}
function requiresBeginningAndEnding(question) {
    return /\b(beginning and ending|opening and ending|begin en einde)\b/i.test(question);
}
function requiresQuotedMaterial(question) {
    return /\b(quote|quotation|quoted|words? or phrases?|haal aan|aanhaling|woorde? of frases?)\b/i.test(question);
}
function hasSufficientEvidenceForQuestion({ subjectKey, questionText, questionType, guidance, readingContent, }) {
    const classification = classifyReadingSourceMaterial(readingContent, subjectKey);
    const requiresSourceEvidence = questionRequiresSourceEvidence({
        subjectKey,
        questionText,
        questionType,
        guidance,
    });
    if (!requiresSourceEvidence) {
        return {
            ok: true,
            requiresSourceEvidence: false,
            reason: "not_required",
            classification,
        };
    }
    if (classification.substantialSourceCount === 0) {
        return {
            ok: false,
            requiresSourceEvidence: true,
            reason: "no_substantial_source",
            classification,
        };
    }
    const normalizedQuestion = normalizeWhitespace(questionText);
    const requiredEvidenceCount = requiresTwoExamples(normalizedQuestion) ? 2 : 1;
    if (requiresTwoTexts(normalizedQuestion) &&
        classification.substantialSourceCount < 2) {
        return {
            ok: false,
            requiresSourceEvidence: true,
            reason: "missing_second_text",
            classification,
        };
    }
    if (requiresBeginningAndEnding(normalizedQuestion)) {
        const structuralSegment = classification.segments.find((segment) => segment.kind === "substantial-source" &&
            segment.wordCount >= 35 &&
            segment.candidateEvidenceCount >= 4);
        if (!structuralSegment) {
            return {
                ok: false,
                requiresSourceEvidence: true,
                reason: "insufficient_structure",
                classification,
            };
        }
    }
    if (requiresQuotedMaterial(normalizedQuestion) &&
        classification.totalCandidateEvidenceCount < requiredEvidenceCount) {
        return {
            ok: false,
            requiresSourceEvidence: true,
            reason: "insufficient_quoted_material",
            classification,
        };
    }
    if (classification.totalCandidateEvidenceCount < requiredEvidenceCount) {
        return {
            ok: false,
            requiresSourceEvidence: true,
            reason: "insufficient_examples",
            classification,
        };
    }
    return {
        ok: true,
        requiresSourceEvidence: true,
        reason: "sufficient",
        classification,
    };
}
function buildLanguageReadingSourceIntegrityPrompt(args) {
    if (!lessonRequiresSubstantialSourceMaterial(args)) {
        return "";
    }
    if (isAfrikaansSubjectKey(args.subjectKey)) {
        return `
TAALBRON-INTEGRITEIT

- Hierdie les vereis werklike teksanalise of teksbewyse.
- Sluit 'n duidelik gemerkte, leerdergerigte bronafdeling in, byvoorbeeld Voorbeeld, Uittreksel, Teks, Gedig, Dialoog of Verhaal soos gepas.
- Die bron moet 'n substansiële oorspronklike teks wees wat groot genoeg is vir onafhanklike ontleding.
- Definisies, verduidelikings en een-sin-voorbeelde is NIE voldoende as die leerder later bewyse uit die teks moet gebruik nie.
- Indien jy analise modelleer, laat genoeg ONBESPROKE bewyse in die bron oor sodat die leerder nog onafhanklik voorbeelde kan identifiseer of aanhaal.
- Moenie al die nuttige bewyse self uitput in die modellering nie.
`;
    }
    return `
LANGUAGE SOURCE-INTEGRITY

- This lesson requires genuine source analysis or evidence retrieval.
- Include a clearly labelled learner-facing source section such as Teaching Extract, Practice Extract, Example, Passage, Poem, Dialogue or Text as appropriate.
- The source must be a substantial original text suitable for independent learner analysis.
- Definitions, explanations and one-sentence illustrative examples are NOT sufficient where learners will later need to quote, identify evidence, or analyse writer's choices.
- If you model analysis, leave enough UNUSED evidence in the source for the learner to identify or quote independently afterwards.
- Do not exhaust all useful evidence in the teaching explanation.
`;
}
function buildLanguageActivitySourceIntegrityPrompt(args) {
    if (!isLanguageSubjectKey(args.subjectKey)) {
        return "";
    }
    const classification = classifyReadingSourceMaterial(args.lessonReading, args.subjectKey);
    const sourceSummary = classification.overallKind === "substantial-source"
        ? `The supplied lesson reading includes ${classification.substantialSourceCount} substantial learner-facing source section(s).`
        : classification.overallKind === "short-illustrative-example"
            ? "The supplied lesson reading contains only short illustrative examples, not a substantial extract."
            : "The supplied lesson reading contains teaching prose only, not a substantial extract.";
    return `
LANGUAGE SOURCE ALIGNMENT

- Curriculum alignment is necessary but insufficient. Every generated question must also be source aligned to the supplied lesson reading.
- Never require information, quotation, evidence or textual analysis that the learner has not actually been given.
- Never invent quotations or pretend that unsupported wording came from the lesson.
- Never refer to the extract, passage, poem, story, uittreksel or teks unless a genuine learner-facing source actually exists in the supplied lesson.
- ${sourceSummary}
- If the lesson does NOT contain substantial source material, do NOT generate questions that require quotation, textual evidence, writer's language, tone, mood, imagery, structure, examples from the text, or comparison between two texts.
- In that case, rewrite the question so it is answerable from the teaching content only.
- If substantial source material DOES exist, only ask evidence-dependent questions when the source genuinely contains enough support for the exact demand.
- If a question asks for two examples, two quotations, two pieces of evidence, or comparison between two texts, ensure the reading genuinely provides that amount of usable source material.
`;
}
