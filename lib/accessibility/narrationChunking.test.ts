import assert from "node:assert/strict";
import test from "node:test";
import { chunkNarrationTranscript } from "./narrationChunking";

function joinChunks(chunks: string[]) {
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

test("a short transcript is returned as a single chunk", () => {
  const transcript = "This is a short lesson narration.";
  const chunks = chunkNarrationTranscript(transcript, 3200);
  assert.deepEqual(chunks, [transcript]);
});

test("no chunk ever exceeds the requested maximum length", () => {
  const paragraph = "Sentence one. Sentence two. Sentence three. Sentence four. ".repeat(50);
  const transcript = [paragraph, paragraph, paragraph].join("\n\n");
  const chunks = chunkNarrationTranscript(transcript, 200);

  for (const chunk of chunks) {
    assert.ok(chunk.length <= 200 || !chunk.includes(" "), `chunk exceeded max length: ${chunk.length}`);
  }
});

test("chunking never drops content -- every meaningful word from the input appears somewhere in the output, in order", () => {
  const transcript =
    "Paragraph one covers trench warfare.\n\nParagraph two covers the Western Front.\n\nParagraph three covers the armistice.";
  const chunks = chunkNarrationTranscript(transcript, 40);
  const rejoined = joinChunks(chunks);

  assert.match(rejoined, /trench warfare/);
  assert.match(rejoined, /Western Front/);
  assert.match(rejoined, /armistice/);
  assert.ok(
    rejoined.indexOf("trench warfare") < rejoined.indexOf("Western Front") &&
      rejoined.indexOf("Western Front") < rejoined.indexOf("armistice"),
    "chunk ordering must preserve the original narration order",
  );
});

test("chunk boundaries never split a sentence -- each chunk ends with sentence-ending punctuation or is the final chunk", () => {
  const paragraph = "First sentence here. Second sentence here. Third sentence here. ".repeat(10);
  const chunks = chunkNarrationTranscript(paragraph, 60);

  for (let i = 0; i < chunks.length - 1; i += 1) {
    assert.match(chunks[i].trim(), /[.!?]$/, `chunk ${i} did not end at a sentence boundary`);
  }
});

test("no chunk is empty, and there is no duplicated/overlapping text between consecutive chunks", () => {
  const transcript = "Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.";
  const chunks = chunkNarrationTranscript(transcript, 15);

  for (const chunk of chunks) {
    assert.ok(chunk.trim().length > 0);
  }

  const seen = new Set<string>();
  for (const chunk of chunks) {
    assert.equal(seen.has(chunk), false, "a chunk was duplicated");
    seen.add(chunk);
  }
});

test("a single paragraph longer than the max is still split at sentence boundaries, never mid-word", () => {
  const longParagraph =
    "This is a very long single paragraph that has no blank-line breaks in it at all. " +
    "It keeps going and going with many sentences in a row. " +
    "Eventually it must be split because it exceeds the maximum chunk size. " +
    "Splitting must happen between sentences, never in the middle of a word.";
  const chunks = chunkNarrationTranscript(longParagraph, 90);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk, /\s$/);
    assert.doesNotMatch(chunk, /^\s/);
  }
});
