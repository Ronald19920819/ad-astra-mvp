// Pure, DOM-free merge logic for Stage D ("Record Answer"). Deliberately
// the ONLY place this decision is made, so both the component and its
// tests share one source of truth.
//
// Product decision (locked): recording must never silently overwrite
// existing learner-written text. An empty textarea receives the
// transcript directly; a non-empty one gets the transcript appended with
// a single separating space. This is intentionally the simplest safe v1
// behaviour -- no dialog, no replace option.
export function mergeTranscriptIntoAnswer(
  existingAnswer: string,
  transcript: string,
): string {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return existingAnswer;

  if (!existingAnswer.trim()) return trimmedTranscript;

  const needsSeparator = !/\s$/.test(existingAnswer);
  return existingAnswer + (needsSeparator ? " " : "") + trimmedTranscript;
}
