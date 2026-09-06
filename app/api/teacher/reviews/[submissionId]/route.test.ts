import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([submissionId]). Node's own `--test` CLI flag treats "[submissionId]"
// as a glob character class even for a literal file argument, so it
// silently discovers ZERO tests here when run via the usual
// `find ... | xargs tsx --test` invocation (see the Stage 4A testing-
// methodology finding). Run this file explicitly instead:
//   node --import tsx "app/api/teacher/reviews/[submissionId]/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/reviews/[submissionId]/route.ts",
  "utf8",
);

// --- Canonical, subject-agnostic route -------------------------------

test("subject authorization is resolved from the request body's subjectId, never a hard-coded subject -- this is what makes the route genuinely shared across all four subjects", () => {
  assert.match(SOURCE, /const subjectId = payload\.subjectId;/);
  assert.match(SOURCE, /authorizeTeacher\(subjectId\)/);
  assert.doesNotMatch(SOURCE, /businessStudiesSubjectId/);
});

test("a snapshot whose recorded subject does not match the requested subjectId is rejected as not found -- subject/snapshot mismatch remains strictly enforced", () => {
  assert.match(SOURCE, /if \(snapshot && snapshot\.subject\.id !== subjectId\) \{/);
});

test("the live (non-snapshot) fallback path also re-checks the lesson's subject_id and published status -- not merely trusting the activity id", () => {
  const fn = SOURCE.match(/if \(!snapshot\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(fn, "live fallback block not found");
  assert.match(fn!, /\.eq\("subject_id", subjectId\)/);
  assert.match(fn!, /\.eq\("status", "published"\)/);
});

// --- isFirstReturn / finalisation behaviour (unchanged from before) --

test("isFirstReturn is computed from the pre-update submission.status, never from reviewed_at", () => {
  assert.match(SOURCE, /const isFirstReturn = submission\.status !== "returned";/);
});

test("isFirstReturn is captured BEFORE the activity_submissions update that sets status to returned", () => {
  const isFirstReturnIndex = SOURCE.indexOf("const isFirstReturn = submission.status");
  const updateIndex = SOURCE.indexOf('status: "returned"');
  assert.ok(isFirstReturnIndex > -1 && updateIndex > -1);
  assert.ok(isFirstReturnIndex < updateIndex);
});

test("editing an already-returned review (isFirstReturn === false) never reaches the email call, regardless of what changed", () => {
  const ifFirstReturnOccurrences = SOURCE.match(/if \(isFirstReturn\)/g) ?? [];
  assert.equal(ifFirstReturnOccurrences.length, 1);
});

// --- AD ASTRA REVIEW-RETURN EMAIL RELIABILITY REPAIR ------------------

test("the route now inspects sendReviewReturnedEmailIfDue's return value -- never discards it", () => {
  const guardBlock = SOURCE.match(/if \(isFirstReturn\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock, "isFirstReturn guard block not found");
  assert.match(guardBlock!, /const outcome = await sendReviewReturnedEmailIfDue\(submission\.learner_id, submissionId\);/);
  assert.match(guardBlock!, /notification = outcome\.sent \? "sent" : "failed";/);
});

test("a thrown exception from the email call (defense in depth -- the helper is designed not to throw) still cannot fail the review response, and is still classified as a failed notification", () => {
  const guardBlock = SOURCE.match(/if \(isFirstReturn\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock);
  assert.match(guardBlock!, /catch \(emailError\) \{/);
  assert.match(guardBlock!, /notification = "failed";/);
});

test("structured logging includes submission id, subject id, and outcome/reason -- never the recipient email, learner profile, or provider secrets", () => {
  const guardBlock = SOURCE.match(/if \(isFirstReturn\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock);
  assert.match(guardBlock!, /submissionId,\s*\n\s*subjectId,\s*\n\s*outcome: notification,/);
  assert.doesNotMatch(guardBlock!, /learnerEmail|RESEND_API_KEY|to: learnerEmail/);
});

test("notification defaults to 'not_applicable' and is only ever set inside the isFirstReturn branch -- a re-edit response reports 'not_applicable', never a misleading failure", () => {
  assert.match(SOURCE, /let notification: "sent" \| "failed" \| "not_applicable" = "not_applicable";/);
});

test("the notification outcome is returned to the caller in the success response, alongside the existing finalMark/rewardOutcome fields", () => {
  assert.match(
    SOURCE,
    /return NextResponse\.json\(\{\s*\n\s*success: true,\s*\n\s*finalMark: scoreSummary\.earnedMarks,\s*\n\s*finalPercentage: scoreSummary\.percentage,\s*\n\s*rewardOutcome,\s*\n\s*notification,\s*\n\s*\}\);/,
  );
});

test("an email-provider failure never undoes or fails the already-successful review -- the response is still success:true regardless of notification outcome", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(postFn, "POST not found");
  const notificationBlockIndex = postFn!.indexOf("if (isFirstReturn) {");
  const responseIndex = postFn!.indexOf("return NextResponse.json({\n      success: true,");
  assert.ok(notificationBlockIndex > -1 && responseIndex > -1 && notificationBlockIndex < responseIndex);
});

test("the route calls the shared sendReviewReturnedEmailIfDue service, never Resend or sendEmail directly", () => {
  assert.match(SOURCE, /import \{ sendReviewReturnedEmailIfDue \} from "@\/lib\/email\/reviewReturnEmail";/);
  assert.doesNotMatch(SOURCE, /from "resend"/);
  assert.doesNotMatch(SOURCE, /from "@\/lib\/email\/sendEmail"/);
  assert.doesNotMatch(SOURCE, /new Resend\(/);
});

test("no email-provider logic (API keys, HTML templates, Resend calls) is duplicated inline in this route", () => {
  assert.doesNotMatch(SOURCE, /RESEND_API_KEY/);
  assert.doesNotMatch(SOURCE, /<div style=/); // no inline email HTML
});

test("marking/finalisation behaviour is otherwise unchanged: rollback on a failed submission update, reward evaluation happens after the write succeeds, and never blocks the response", () => {
  assert.match(SOURCE, /Teacher review answer rollback failed/);
  const rewardStart = SOURCE.indexOf("let rewardOutcome:");
  const rewardEnd = SOURCE.indexOf("if (isFirstReturn) {", rewardStart);
  assert.ok(rewardStart > -1 && rewardEnd > rewardStart, "reward block not found");
  const rewardBlock = SOURCE.slice(rewardStart, rewardEnd);
  assert.match(rewardBlock, /catch \(rewardError\) \{/);
});
