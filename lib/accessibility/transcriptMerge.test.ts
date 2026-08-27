import assert from "node:assert/strict";
import test from "node:test";
import { mergeTranscriptIntoAnswer } from "./transcriptMerge";

test("K: an empty textarea receives the transcript directly", () => {
  assert.equal(
    mergeTranscriptIntoAnswer("", "The business might use primary research."),
    "The business might use primary research.",
  );
});

test("a whitespace-only existing answer is treated as empty", () => {
  assert.equal(
    mergeTranscriptIntoAnswer("   \n  ", "Primary research is direct."),
    "Primary research is direct.",
  );
});

test("L: existing typed text is preserved and the transcript is appended, never overwritten", () => {
  const result = mergeTranscriptIntoAnswer(
    "Primary research is data collected directly.",
    "It can ask customers directly.",
  );
  assert.equal(
    result,
    "Primary research is data collected directly. It can ask customers directly.",
  );
});

test("appending never introduces a double space when the existing text already ends with whitespace", () => {
  const result = mergeTranscriptIntoAnswer(
    "Primary research is direct. \n",
    "It can ask customers directly.",
  );
  assert.equal(result, "Primary research is direct. \nIt can ask customers directly.");
});

test("the transcript itself is trimmed before merging, so trailing STT whitespace never leaks into the answer", () => {
  const result = mergeTranscriptIntoAnswer("Existing text.", "  new spoken text.  ");
  assert.equal(result, "Existing text. new spoken text.");
});

test("V: an empty/whitespace-only transcript (no speech detected) never mutates the existing answer at all", () => {
  assert.equal(mergeTranscriptIntoAnswer("Existing text.", ""), "Existing text.");
  assert.equal(mergeTranscriptIntoAnswer("Existing text.", "   "), "Existing text.");
  assert.equal(mergeTranscriptIntoAnswer("", "   "), "");
});

test("Afrikaans text merges identically to English -- no language-specific merge behaviour", () => {
  const result = mergeTranscriptIntoAnswer(
    "Primêre navorsing is direkte data.",
    "Dit kan kliënte direk vra.",
  );
  assert.equal(result, "Primêre navorsing is direkte data. Dit kan kliënte direk vra.");
});
