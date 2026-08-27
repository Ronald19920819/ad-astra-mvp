// Deterministic, sentence/paragraph-safe chunking for TTS. gpt-4o-mini-tts
// caps input length (4096 characters per the SDK's SpeechCreateParams doc),
// so a long lesson narration transcript must be split into multiple
// requests. Splitting only ever happens at a paragraph boundary, or -- for
// a single oversized paragraph -- at a sentence boundary. Never mid-word,
// never with overlap, never dropping content: every character of the input
// (aside from boundary whitespace) ends up in exactly one output chunk, in
// order.
const DEFAULT_MAX_CHARS = 3200;

function splitIntoSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return (matches ?? [paragraph]).map((sentence) => sentence.trim()).filter(Boolean);
}

function splitOversizedParagraph(paragraph: string, maxChars: number): string[] {
  const sentences = splitIntoSentences(paragraph);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) pieces.push(current);
  // A single sentence longer than maxChars on its own is kept intact
  // rather than cut mid-word -- exceptionally rare for narration prose,
  // and a slightly oversized request is safer than corrupted speech.
  return pieces;
}

export function chunkNarrationTranscript(
  transcript: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): string[] {
  const paragraphs = transcript
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > maxChars
        ? splitOversizedParagraph(paragraph, maxChars)
        : [paragraph];

    for (const piece of pieces) {
      const candidate = current ? `${current}\n\n${piece}` : piece;
      if (candidate.length > maxChars && current) {
        chunks.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
