import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via
// lib/email/reviewReturnEmail.ts, lib/supabase/teacherAuth.ts, etc.),
// which has no real node_modules entry and only resolves inside a Next.js
// server build/bundle -- so, matching this codebase's established
// precedent (see activityReviewReader.historicalVisibility.test.ts's
// header comment), the route handler cannot be invoked directly in a
// plain node:test run. These tests verify the real source directly
// instead.

const SOURCE = readFileSync(
  "app/api/teacher/business-studies/reviews/[submissionId]/route.ts",
  "utf8",
);

test("isFirstReturn is computed from the pre-update submission.status, never from reviewed_at", () => {
  assert.match(SOURCE, /const isFirstReturn = submission\.status !== "returned";/);
});

test("isFirstReturn is captured BEFORE the activity_submissions update that sets status to returned", () => {
  const isFirstReturnIndex = SOURCE.indexOf("const isFirstReturn = submission.status");
  const updateIndex = SOURCE.indexOf('status: "returned"');
  assert.ok(isFirstReturnIndex > -1 && updateIndex > -1);
  assert.ok(isFirstReturnIndex < updateIndex);
});

test("the review-return email is only invoked when isFirstReturn is true, gated behind the successful database write", () => {
  const emailCallIndex = SOURCE.indexOf("sendReviewReturnedEmailIfDue(");
  assert.ok(emailCallIndex > -1, "sendReviewReturnedEmailIfDue call not found");

  const guardBlock = SOURCE.match(/if \(isFirstReturn\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock, "isFirstReturn guard block not found");
  assert.match(guardBlock!, /sendReviewReturnedEmailIfDue\(submission\.learner_id, submissionId\)/);

  // The email call happens after the submission update (and its error
  // handling) has already completed successfully.
  const submissionUpdateIndex = SOURCE.indexOf("submissionUpdateError) {");
  assert.ok(submissionUpdateIndex > -1 && submissionUpdateIndex < emailCallIndex);
});

test("editing an already-returned review (isFirstReturn === false) never reaches the email call, regardless of what changed", () => {
  // isFirstReturn is a single boolean computed once from the row fetched
  // before any write -- there is no secondary code path that could still
  // invoke the email service when it is false.
  const ifFirstReturnOccurrences = SOURCE.match(/if \(isFirstReturn\)/g) ?? [];
  assert.equal(ifFirstReturnOccurrences.length, 1);
});

test("an email-provider failure is caught and logged, never allowed to fail or undo the already-successful review", () => {
  const guardBlock = SOURCE.match(/if \(isFirstReturn\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock);
  assert.match(guardBlock!, /try \{[\s\S]*catch \(emailError\) \{/);
  assert.match(guardBlock!, /console\.error\("Review-return email failed after teacher review:"/);
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
