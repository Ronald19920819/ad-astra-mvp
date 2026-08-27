import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// This route imports "server-only" transitively and cannot be invoked
// directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent. Path resolved relative to this file's own location
// since its directory name contains glob-metacharacter brackets
// ([lessonId]) -- see scripts/run-accessibility-route-test.mjs for the
// CLI-invocation workaround this file also needs.

const routeSourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "route.ts",
);
const SOURCE = readFileSync(routeSourcePath, "utf8");

test("O: a learner quiz question audio request is authenticated via the real session -- never a client-supplied learner ID", () => {
  assert.match(SOURCE, /requestClient\.auth\.getUser\(\)/);
  assert.doesNotMatch(SOURCE, /searchParams\.get\("(learnerId|authUserId|userId)"\)/);
  assert.match(SOURCE, /if \(userError \|\| !user\) \{/);
});

test("P: the route checks getLearnerAccessibilityEntitlement and rejects a non-entitled learner with 403 before ever generating or serving audio", () => {
  assert.match(SOURCE, /getLearnerAccessibilityEntitlement\(\{\s*authUserId: user\.id,?\s*\}\)/);
  assert.match(SOURCE, /if \(!entitlement\.accessibilityEnabled\)/);

  const entitlementCheckIndex = SOURCE.indexOf("entitlement.accessibilityEnabled");
  const audioGenerationIndex = SOURCE.indexOf("getOrGenerateQuestionAudioUrl(");
  assert.ok(entitlementCheckIndex > -1 && audioGenerationIndex > -1);
  assert.ok(entitlementCheckIndex < audioGenerationIndex);
});

test("subject enrolment access is verified via the canonical verifyLearnerSubjectAccess helper -- not re-implemented here", () => {
  assert.match(SOURCE, /verifyLearnerSubjectAccess\(user\.id, lesson\.subject_id\)/);
});

test("Q: the requested question is scoped to THIS lesson's own quiz activity -- an arbitrary questionId from another lesson/subject/activity can never be served", () => {
  assert.match(
    SOURCE,
    /\.from\("activity_questions"\)[\s\S]*?\.eq\("id", questionId\)[\s\S]*?\.eq\("activity_id", activity\.id\)/,
  );
});

test("only a published lesson's quiz can ever be served to a learner", () => {
  assert.match(SOURCE, /lesson\.status !== "published"/);
});

test("the only lesson_materials query filters by material_type 'quiz' -- reading/video materials can never be resolved as a quiz question source", () => {
  assert.match(SOURCE, /\.eq\("material_type", "quiz"\)/);
});

test("J: the question select never includes correct_option, guidance, paper, or assessment_objective -- only learner-facing question content", () => {
  const selectCall = SOURCE.match(
    /\.from\("activity_questions"\)\s*\.select\("([^"]+)"\)/,
  );
  assert.ok(selectCall, "activity_questions select not found");
  const selectedColumns = selectCall![1];
  assert.doesNotMatch(selectedColumns, /correct_option/);
  assert.doesNotMatch(selectedColumns, /guidance/);
  assert.doesNotMatch(selectedColumns, /\bpaper\b/);
  assert.doesNotMatch(selectedColumns, /assessment_objective/);
  assert.match(selectedColumns, /question_text/);
  assert.match(selectedColumns, /option_a/);
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

test("N: on any failure, the learner sees only the friendly UNAVAILABLE_MESSAGE -- never the raw caught error, a signed URL, or a question/lesson ID", () => {
  assert.match(SOURCE, /const UNAVAILABLE_MESSAGE = "Question audio is unavailable\. Please try again\.";/);
  const catchBlock = SOURCE.match(/\} catch \(error\) \{[\s\S]*$/)?.[0] ?? "";
  const returnedResponse = catchBlock.match(/return Response\.json\([^;]*\);/)?.[0] ?? "";
  assert.match(returnedResponse, /Response\.json\(\{ error: UNAVAILABLE_MESSAGE \}/);
  assert.doesNotMatch(returnedResponse, /error\.message/);
  assert.doesNotMatch(returnedResponse, /lessonId|questionId/);
});

test("S/T: this route never touches a quiz answer, quiz score, lesson completion, XP, or Coin table -- it is playback-only", () => {
  assert.doesNotMatch(SOURCE, /learner_quiz_attempts|learner_lesson_completions|coin_transactions|xp_/i);
});
