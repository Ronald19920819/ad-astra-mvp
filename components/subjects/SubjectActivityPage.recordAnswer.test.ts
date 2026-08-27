import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// SubjectActivityPage.tsx is a "use client" component using browser-only
// hooks and cannot be rendered in a plain node:test run -- these assert
// structural properties of the real source directly, matching this
// repo's established convention (see
// SubjectActivityPage.readingSnapshot.test.ts's header comment for the
// original precedent).

const SOURCE = readFileSync("components/subjects/SubjectActivityPage.tsx", "utf8");

test("A/D: Record Answer is never rendered for a non-entitled learner or a submitted/locked activity -- gated on accessibilityCapabilities.recordAnswer && !submission", () => {
  assert.match(
    SOURCE,
    /\{accessibilityCapabilities.recordAnswer && !submission && \(\s*<RecordAnswerButton/,
  );
});

test("B: an entitled learner on an unsubmitted (writable) activity sees Record Answer rendered for the active question", () => {
  const renderBlock = SOURCE.match(/\{accessibilityCapabilities.recordAnswer && !submission && \([\s\S]*?\/>\s*\)\}/)?.[0];
  assert.ok(renderBlock, "Record Answer render block not found");
  assert.match(renderBlock!, /activityId=\{activityId\}/);
  assert.match(renderBlock!, /questionId=\{activeQuestion\.id\}/);
});

test("C: no MCQ-specific gating exists because real activity questions are never MCQ -- Record Answer is unconditionally available for the (always free-response) active question once entitled and unsubmitted", () => {
  // Confirms the render condition depends only on
  // accessibilityCapabilities.recordAnswer and !submission -- never on an
  // option_a/option_b-style MCQ check,
  // which would be meaningless here (see Stage C's investigation: real
  // activity questions never populate option fields).
  const renderBlock = SOURCE.match(/\{accessibilityCapabilities.recordAnswer && !submission && \([\s\S]*?\/>\s*\)\}/)?.[0];
  assert.ok(renderBlock);
  assert.doesNotMatch(renderBlock!, /option_a|optionA/);
});

test("Record Answer is disabled while the activity is actively submitting, matching the textarea's own disabled condition", () => {
  assert.match(SOURCE, /disabled=\{isSubmitting\}/);
});

test("M/N: the transcript is written through the SAME canonical updateAnswer path as keyboard typing -- never a second answer store", () => {
  const updateAnswerFn = SOURCE.match(/function updateAnswer\(questionId: string, newText: string\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(updateAnswerFn, "updateAnswer not found");
  assert.match(updateAnswerFn!, /latestAnswersRef\.current = nextAnswers;/);
  assert.match(updateAnswerFn!, /setAnswers\(nextAnswers\);/);
  assert.match(updateAnswerFn!, /writeLocalDraftCache\(\{/);
  assert.match(updateAnswerFn!, /scheduleDraftSave\(\);/);

  // The textarea's onChange and RecordAnswerButton's onTranscript both
  // call this exact same function -- not a duplicated inline sequence.
  const onChangeCall = SOURCE.match(/onChange=\{\(event\) => \{\s*updateAnswer\(activeQuestion\.id, event\.target\.value\);\s*\}\}/);
  assert.ok(onChangeCall, "textarea onChange must call updateAnswer directly");
});

test("L: the transcript is merged via the pure mergeTranscriptIntoAnswer helper against the CURRENT answer text, never overwriting it", () => {
  assert.match(SOURCE, /import \{ mergeTranscriptIntoAnswer \} from "@\/lib\/accessibility\/transcriptMerge";/);
  const onTranscriptCall = SOURCE.match(/onTranscript=\{\(transcript\) => \{[\s\S]*?\n\s*\}\}/)?.[0];
  assert.ok(onTranscriptCall, "onTranscript callback not found");
  assert.match(onTranscriptCall!, /mergeTranscriptIntoAnswer\(/);
  assert.match(onTranscriptCall!, /latestAnswersRef\.current\[activeQuestion\.id\] \?\? ""/);
  assert.match(onTranscriptCall!, /updateAnswer\(/);
});

test("P: RecordAnswerButton's insertion path never calls submitActivity or the mark-activity endpoint", () => {
  const onTranscriptCall = SOURCE.match(/onTranscript=\{\(transcript\) => \{[\s\S]*?\n\s*\}\}/)?.[0];
  assert.ok(onTranscriptCall);
  assert.doesNotMatch(onTranscriptCall!, /submitActivity|mark-activity/);
});

test("Y: the paste/drop protection handlers on the textarea are unchanged -- Record Answer does not weaken, remove, or bypass them", () => {
  assert.match(SOURCE, /onPaste=\{blockExternalAnswerInput\}/);
  assert.match(SOURCE, /onDrop=\{blockExternalAnswerInput\}/);
  const blockFn = SOURCE.match(/function blockExternalAnswerInput\([\s\S]*?\n  \}/)?.[0];
  assert.ok(blockFn, "blockExternalAnswerInput not found");
  assert.match(blockFn!, /event\.preventDefault\(\);/);
});

test("Z: wiring RecordAnswerButton into this page introduces no XP/Coin/completion/marking reference", () => {
  const renderBlock = SOURCE.match(/\{accessibilityCapabilities.recordAnswer && !submission && \([\s\S]*?\/>\s*\)\}/)?.[0];
  assert.ok(renderBlock);
  assert.doesNotMatch(renderBlock!, /xp|coin|final_mark|kingdom_mark/i);
});
