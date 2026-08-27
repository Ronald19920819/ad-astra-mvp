import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// See app/api/lessons/[lessonId]/quiz-question-audio/route.test.ts's header
// comment for why this file uses source inspection rather than invoking
// the route directly, and scripts/run-accessibility-route-test.mjs for the
// bracket-path CLI-invocation workaround.

const routeSourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "route.ts",
);
const SOURCE = readFileSync(routeSourcePath, "utf8");

test("O: a learner activity question audio request is authenticated via the real session -- never a client-supplied learner ID", () => {
  assert.match(SOURCE, /requestClient\.auth\.getUser\(\)/);
  assert.doesNotMatch(SOURCE, /searchParams\.get\("(learnerId|authUserId|userId)"\)/);
  assert.match(SOURCE, /if \(userError \|\| !user\) \{/);
});

test("P: the route checks getLearnerAccessibilityEntitlement and rejects a non-entitled learner with 403 before ever resolving or serving audio", () => {
  assert.match(SOURCE, /getLearnerAccessibilityEntitlement\(\{\s*authUserId: user\.id,?\s*\}\)/);
  assert.match(SOURCE, /if \(!entitlement\.accessibilityEnabled\)/);

  const entitlementCheckIndex = SOURCE.indexOf("entitlement.accessibilityEnabled");
  const resolveIndex = SOURCE.indexOf("await resolveQuestionAudioSource(");
  const audioGenerationIndex = SOURCE.lastIndexOf("getOrGenerateQuestionAudioUrl(");
  assert.ok(entitlementCheckIndex > -1 && resolveIndex > -1 && audioGenerationIndex > -1);
  assert.ok(entitlementCheckIndex < resolveIndex);
  assert.ok(resolveIndex < audioGenerationIndex);
});

test("R: a submission owned by the requesting learner is used as the authoritative source, matching the exact precedent of the frozen-snapshot PDF route", () => {
  assert.match(
    SOURCE,
    /\.from\("activity_submissions"\)[\s\S]*?\.eq\("activity_id", activityId\)[\s\S]*?\.eq\("learner_id", authUserId\)/,
  );
  assert.match(SOURCE, /isActivitySubmissionSnapshot\(submission\.activity_snapshot\)/);
  assert.match(SOURCE, /snapshotQuestionById\(snapshot\)\.get\(questionId\)/);
});

test("Q: a submitted learner's question lookup is scoped to their OWN snapshot's question map -- an unrelated questionId resolves to not-found, never another learner's or another activity's question", () => {
  const snapshotBranch = SOURCE.match(/if \(snapshot\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(snapshotBranch, "snapshot branch not found");
  assert.match(snapshotBranch!, /if \(!question\) \{\s*return \{ ok: false, status: 404/);
});

test("Q: an unsubmitted activity's question lookup is scoped to THIS activity -- an arbitrary questionId from another activity can never be served", () => {
  assert.match(
    SOURCE,
    /\.from\("activity_questions"\)[\s\S]*?\.eq\("id", questionId\)[\s\S]*?\.eq\("activity_id", activityId\)/,
  );
});

test("an unsubmitted activity still requires the canonical verifyLearnerSubjectAccess subject-enrolment check -- not re-implemented here", () => {
  assert.match(SOURCE, /verifyLearnerSubjectAccess\(authUserId, lesson\.subject_id\)/);
});

test("only a published lesson's linked activity can be served for the live (unsubmitted) path", () => {
  assert.match(SOURCE, /lesson\.status !== "published"/);
});

test("J: neither the snapshot path nor the live path ever reads correct_option, guidance, or paper into the spoken source", () => {
  const selectCall = SOURCE.match(
    /\.from\("activity_questions"\)\s*\.select\("([^"]+)"\)/,
  );
  assert.ok(selectCall, "activity_questions select not found");
  const selectedColumns = selectCall![1];
  assert.doesNotMatch(selectedColumns, /correct_option/);
  assert.doesNotMatch(selectedColumns, /guidance/);
  assert.doesNotMatch(selectedColumns, /\bpaper\b/);

  assert.doesNotMatch(SOURCE, /question\.guidance/);
  assert.doesNotMatch(SOURCE, /\.paper\b/);
});

test("the voice/language decision is delegated to the existing canonical accessibility voice helper -- never a hardcoded voice name in this route", () => {
  assert.match(SOURCE, /getAccessibilityNarrationVoice\(subject\.familyKey\)/);
  assert.doesNotMatch(SOURCE, /"cedar"|"marin"/);
});

test("the spoken script is built via the pure, deterministic questionSpeech helper -- no AI narration rewrite/approval step for question audio", () => {
  assert.match(SOURCE, /buildQuestionSpeechScript\(/);
  assert.doesNotMatch(SOURCE, /generateAccessibilityNarrationTranscript|validateAccessibilityNarration|approveTranscript/);
});

test("audio generation/caching is delegated to the shared question audio module -- this route never calls the OpenAI SDK or storage APIs directly", () => {
  assert.match(SOURCE, /getOrGenerateQuestionAudioUrl\(/);
  assert.doesNotMatch(SOURCE, /new OpenAI\(/);
  assert.doesNotMatch(SOURCE, /\.storage\./);
});

test("N: on any failure, the learner sees only the friendly UNAVAILABLE_MESSAGE -- never the raw caught error, a signed URL, or an activity/question ID", () => {
  assert.match(SOURCE, /const UNAVAILABLE_MESSAGE = "Question audio is unavailable\. Please try again\.";/);
  const catchBlock = SOURCE.match(/\} catch \(error\) \{[\s\S]*$/)?.[0] ?? "";
  const returnedResponse = catchBlock.match(/return Response\.json\([^;]*\);/)?.[0] ?? "";
  assert.match(returnedResponse, /Response\.json\(\{ error: UNAVAILABLE_MESSAGE \}/);
  assert.doesNotMatch(returnedResponse, /error\.message/);
  assert.doesNotMatch(returnedResponse, /activityId|questionId/);
});

test("S/T: this route never touches an activity answer/draft, submission status, final mark, lesson completion, XP, or Coin table -- it is playback-only", () => {
  assert.doesNotMatch(
    SOURCE,
    /activity_drafts|final_mark|preliminary_mark|coin_transactions|xp_|learner_lesson_completions/i,
  );
  assert.doesNotMatch(SOURCE, /\.update\(/);
  assert.doesNotMatch(SOURCE, /\.insert\(/);
});
