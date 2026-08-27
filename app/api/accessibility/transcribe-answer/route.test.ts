import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Imports "server-only" transitively -- source inspection, matching the
// established convention (see
// app/api/live-class/livekit-token/route.test.ts's header comment).

const SOURCE = readFileSync("app/api/accessibility/transcribe-answer/route.ts", "utf8");

test("E: authenticated via the real session -- never a client-supplied learner ID", () => {
  assert.match(SOURCE, /requestClient\.auth\.getUser\(\)/);
  assert.doesNotMatch(SOURCE, /formData\.get\("(learnerId|authUserId|userId)"\)/);
  assert.match(SOURCE, /if \(userError \|\| !user\) \{/);
});

test("F: the route checks getLearnerAccessibilityEntitlement and rejects a non-entitled learner with 403 before ever transcribing", () => {
  assert.match(SOURCE, /getLearnerAccessibilityEntitlement\(\{\s*authUserId: user\.id,?\s*\}\)/);
  assert.match(SOURCE, /if \(!entitlement\.accessibilityEnabled\)/);

  const entitlementIndex = SOURCE.indexOf("entitlement.accessibilityEnabled");
  const transcribeIndex = SOURCE.indexOf("transcribeAnswerAudio(");
  assert.ok(entitlementIndex > -1 && transcribeIndex > -1);
  assert.ok(entitlementIndex < transcribeIndex);
});

test("H: an activity that already has a submission for this learner is hard-rejected -- no snapshot fallback, recording is never allowed post-submission", () => {
  assert.match(
    SOURCE,
    /\.from\("activity_submissions"\)[\s\S]*?\.eq\("activity_id", activityId\)[\s\S]*?\.eq\("learner_id", user\.id\)/,
  );
  assert.match(SOURCE, /if \(existingSubmission\) \{/);
  const rejectBlock = SOURCE.match(/if \(existingSubmission\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(rejectBlock);
  assert.match(rejectBlock!, /status: 409/);
});

test("an unsubmitted activity still requires the canonical verifyLearnerSubjectAccess subject-enrolment check -- not re-implemented here", () => {
  assert.match(SOURCE, /verifyLearnerSubjectAccess\(user\.id, lesson\.subject_id\)/);
});

test("only a published lesson's linked activity can accept a recording", () => {
  assert.match(SOURCE, /lesson\.status !== "published"/);
});

test("G: the requested question is scoped to THIS activity -- an arbitrary questionId from another activity can never be transcribed against it", () => {
  assert.match(
    SOURCE,
    /\.from\("activity_questions"\)[\s\S]*?\.eq\("id", questionId\)[\s\S]*?\.eq\("activity_id", activityId\)/,
  );
});

test("U: uploaded audio is validated for type and bounded by a real size limit before ever reaching the transcription API", () => {
  assert.match(SOURCE, /audio\.type\.startsWith\("audio\/"\)/);
  assert.match(SOURCE, /const MAX_AUDIO_BYTES = 10 \* 1024 \* 1024;/);
  assert.match(SOURCE, /audio\.size > MAX_AUDIO_BYTES/);
});

test("V: an empty upload or an all-silence transcription result both resolve to the same friendly 'no speech detected' message", () => {
  assert.match(SOURCE, /const EMPTY_SPEECH_MESSAGE = "No speech was detected\. Please try again\.";/);
  assert.match(SOURCE, /audio\.size === 0\) \{\s*return Response\.json\(\{ error: EMPTY_SPEECH_MESSAGE \}/);
  assert.match(SOURCE, /if \(!text\.trim\(\)\) \{\s*return Response\.json\(\{ error: EMPTY_SPEECH_MESSAGE \}/);
});

test("R/S: the language hint passed to transcription is derived from the canonical subject voice/language mapping -- never hardcoded per page", () => {
  assert.match(SOURCE, /getAccessibilityNarrationVoice\(subject\.familyKey\)/);
  assert.match(SOURCE, /toTranscriptionLanguageCode\(language\)/);
});

test("Q: transcription is delegated to the shared answerTranscription module -- this route never calls the OpenAI SDK directly, and never rewrites the returned text", () => {
  assert.match(SOURCE, /transcribeAnswerAudio\(/);
  assert.doesNotMatch(SOURCE, /new OpenAI\(/);
  assert.match(SOURCE, /return Response\.json\(\{ text \}\);/);
});

test("T: raw audio is never written to disk or uploaded to Storage -- it is read into memory and handed straight to transcription", () => {
  assert.doesNotMatch(SOURCE, /\.storage\.|writeFile|createWriteStream/);
  assert.match(SOURCE, /Buffer\.from\(await audio\.arrayBuffer\(\)\)/);
});

test("N: on any unexpected failure, the learner sees only the friendly UNAVAILABLE_MESSAGE -- never the raw caught error or a question/activity ID", () => {
  assert.match(SOURCE, /const UNAVAILABLE_MESSAGE =\s*\n?\s*"Your recording could not be transcribed\. Please try again\.";/);
  const catchBlock = SOURCE.match(/\} catch \(error\) \{[\s\S]*$/)?.[0] ?? "";
  const returnedResponse = catchBlock.match(/return Response\.json\([^;]*\);/)?.[0] ?? "";
  assert.match(returnedResponse, /Response\.json\(\{ error: UNAVAILABLE_MESSAGE \}/);
  assert.doesNotMatch(returnedResponse, /error\.message/);
  assert.doesNotMatch(returnedResponse, /activityId|questionId/);
});

test("B/C: the client-reported recording duration is read from the request and validated as a finite, positive number within the shared max-duration limit before being trusted for anything", () => {
  assert.match(SOURCE, /formData\.get\("recordingDurationSeconds"\)/);
  assert.match(SOURCE, /import \{ MAX_RECORDING_SECONDS \} from "@\/lib\/accessibility\/recordingLimits";/);
  const validationBlock = SOURCE.match(/if \(\s*typeof activityId[\s\S]*?\n\s*\) \{/)?.[0];
  assert.ok(validationBlock, "combined validation block not found");
  assert.match(validationBlock!, /!Number\.isFinite\(recordingDurationSeconds\)/);
  assert.match(validationBlock!, /recordingDurationSeconds <= 0/);
  assert.match(validationBlock!, /recordingDurationSeconds > MAX_RECORDING_SECONDS/);
});

test("F/G: a returned transcript is checked for plausibility against the reported recording duration before ever being sent back to the learner -- an implausible one is rejected with the exact controlled code and never returned as text", () => {
  assert.match(SOURCE, /import \{ checkTranscriptPlausibility \} from "@\/lib\/accessibility\/transcriptPlausibility";/);
  assert.match(SOURCE, /checkTranscriptPlausibility\(\{\s*recordingDurationSeconds,\s*transcriptText: text,\s*\}\)/);
  const rejectionBlock = SOURCE.match(/if \(!plausibility\.plausible\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(rejectionBlock, "plausibility rejection block not found");
  assert.match(rejectionBlock!, /code: plausibility\.reason/);
  assert.doesNotMatch(rejectionBlock!, /text: text|\{ text \}/);
  assert.match(
    SOURCE,
    /const IMPLAUSIBLE_TRANSCRIPT_MESSAGE =\s*\n?\s*"Your recording could not be fully transcribed\. Please try again\.";/,
  );

  // The plausibility check runs strictly before the final success
  // response.
  const plausibilityIndex = SOURCE.indexOf("checkTranscriptPlausibility(");
  const successIndex = SOURCE.lastIndexOf("return Response.json({ text });");
  assert.ok(plausibilityIndex > -1 && successIndex > -1);
  assert.ok(plausibilityIndex < successIndex);
});

test("Z: this route never touches marks, Kingdom marking, completion, XP, or Coin tables -- it only ever reads activity/question/submission-existence rows and returns text", () => {
  assert.doesNotMatch(
    SOURCE,
    /final_mark|preliminary_mark|kingdom_mark|coin_transactions|xp_|learner_lesson_completions|mark-activity/i,
  );
  assert.doesNotMatch(SOURCE, /\.update\(/);
  assert.doesNotMatch(SOURCE, /\.insert\(/);
});
