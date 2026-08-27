import assert from "node:assert/strict";
import test from "node:test";
import { checkTranscriptPlausibility } from "./transcriptPlausibility";

test("F: a 40-second recording that returns only 'This is a test' is rejected as implausibly short", () => {
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 40,
    transcriptText: "This is a test",
  });
  assert.deepEqual(result, { plausible: false, reason: "TRANSCRIPTION_IMPLAUSIBLY_SHORT" });
});

test("E: a 40-second recording with a plausible, longer transcript passes", () => {
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 40,
    transcriptText:
      "The business might use primary research because it can ask customers directly what they think about the new product before launching it nationally.",
  });
  assert.deepEqual(result, { plausible: true });
});

test("D: a short recording with a short (even one-word) transcript is never rejected -- brief genuine answers must not be second-guessed", () => {
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 5,
    transcriptText: "Yes.",
  });
  assert.deepEqual(result, { plausible: true });
});

test("recordings at or under the exempt threshold are never checked, regardless of transcript content", () => {
  assert.deepEqual(
    checkTranscriptPlausibility({ recordingDurationSeconds: 8, transcriptText: "" }),
    { plausible: true },
  );
  assert.deepEqual(
    checkTranscriptPlausibility({ recordingDurationSeconds: 1, transcriptText: "No." }),
    { plausible: true },
  );
});

test("a long recording with a genuinely empty transcript is rejected", () => {
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 60,
    transcriptText: "",
  });
  assert.deepEqual(result, { plausible: false, reason: "TRANSCRIPTION_IMPLAUSIBLY_SHORT" });
});

test("the threshold is deliberately conservative -- a slow, deliberate speaker with pauses over a full minute still passes with well under conversational word-per-minute rates", () => {
  // ~15 words over 60 seconds is an extremely slow, pause-heavy pace
  // (conversational speech is 110-150+ words/minute) -- this must still
  // pass, proving the heuristic favours false negatives over
  // false positives.
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 60,
    transcriptText: "Primary research means collecting new data directly from customers instead of using existing published sources or reports.",
  });
  assert.deepEqual(result, { plausible: true });
});

test("increasing recording duration raises the expected minimum word count proportionally", () => {
  const shortDuration = checkTranscriptPlausibility({
    recordingDurationSeconds: 20,
    transcriptText: "A short answer here now",
  });
  const longDuration = checkTranscriptPlausibility({
    recordingDurationSeconds: 120,
    transcriptText: "A short answer here now",
  });
  assert.equal(shortDuration.plausible, true);
  assert.equal(longDuration.plausible, false);
});

test("the check is purely quantitative -- it never inspects the semantic content of the transcript, only its word count", () => {
  // Nonsense words in sufficient quantity still pass -- this heuristic
  // must never attempt to grade or evaluate correctness.
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 40,
    transcriptText: "flibber jorwick nonsense words that mean absolutely nothing at all here",
  });
  assert.deepEqual(result, { plausible: true });
});

test("whitespace-only transcript text is treated as zero words, not one", () => {
  const result = checkTranscriptPlausibility({
    recordingDurationSeconds: 40,
    transcriptText: "     ",
  });
  assert.deepEqual(result, { plausible: false, reason: "TRANSCRIPTION_IMPLAUSIBLY_SHORT" });
});
