// Conservative, non-semantic plausibility guard for Stage D transcripts.
// This exists to catch ONE specific failure class: the STT provider
// silently returning a drastically-too-short (or otherwise obviously
// incomplete) result for a genuinely long recording -- e.g. a 40-second
// answer coming back as "This is a test". It must NEVER grade content,
// guess what the learner "should" have said, or penalise a learner who
// simply gave a brief answer. When in doubt, this must let the
// transcript through -- a missed truncation is far less harmful than
// rejecting a learner's genuine short answer.

// Recordings at or below this length are NEVER checked at all -- a
// learner giving a short, valid answer (or a single word) must never be
// second-guessed just because their recording was brief.
export const PLAUSIBILITY_EXEMPT_DURATION_SECONDS = 8;

// Deliberately far below genuine speech (average conversational speech
// is ~110-150 words/minute; even a very slow, deliberate speaker with
// long pauses rarely drops below ~60/minute). This floor exists only to
// catch a transcript that is implausible for ANY speaking pace, not to
// model realistic speech.
const MIN_PLAUSIBLE_WORDS_PER_MINUTE = 15;

export type PlausibilityCheckResult =
  | { plausible: true }
  | { plausible: false; reason: "TRANSCRIPTION_IMPLAUSIBLY_SHORT" };

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Pure, deterministic, non-semantic: only ever compares a duration to a
// word count. Never inspects what the words actually say.
export function checkTranscriptPlausibility(args: {
  recordingDurationSeconds: number;
  transcriptText: string;
}): PlausibilityCheckResult {
  if (args.recordingDurationSeconds <= PLAUSIBILITY_EXEMPT_DURATION_SECONDS) {
    return { plausible: true };
  }

  const minutes = args.recordingDurationSeconds / 60;
  const expectedMinimumWords = Math.floor(minutes * MIN_PLAUSIBLE_WORDS_PER_MINUTE);
  const actualWords = countWords(args.transcriptText);

  if (actualWords < expectedMinimumWords) {
    return { plausible: false, reason: "TRANSCRIPTION_IMPLAUSIBLY_SHORT" };
  }

  return { plausible: true };
}
