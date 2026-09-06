import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// reviewReturnEmail.ts begins with `import "server-only"` and calls
// createSupabaseAdminClient(), so per this codebase's established
// precedent (see activityReviewReader.historicalVisibility.test.ts's
// header comment) it cannot be invoked directly in a plain node:test run.
// The query-shape/control-flow assertions below confirm the real source
// contains the exact claim/release/finalize logic this test's mirrored
// race-condition model assumes, so the two stay in sync intentionally.
// This stage sends no real email in tests -- there is no live Resend call
// anywhere below.

const SOURCE = readFileSync("lib/email/reviewReturnEmail.ts", "utf8");

test("the atomic claim requires BOTH sent_at and claimed_at to be null, matching 'UPDATE ... WHERE sent_at IS NULL AND claimed_at IS NULL'", () => {
  const claimBlock = SOURCE.match(/\.update\(\{ review_returned_email_claimed_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*?\.maybeSingle\(\);/)?.[0];
  assert.ok(claimBlock, "claim update block not found");
  assert.match(claimBlock!, /\.is\("review_returned_email_sent_at", null\)/);
  assert.match(claimBlock!, /\.is\("review_returned_email_claimed_at", null\)/);
});

test("a lost claim (no row returned) is skipped silently, never treated as an error", () => {
  assert.match(SOURCE, /if \(!claimedRow\) \{/);
  const skipBlock = SOURCE.match(/if \(!claimedRow\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(skipBlock);
  assert.match(skipBlock!, /reason: "already_claimed_or_sent"/);
});

test("reviewed_at is never used as the idempotency marker anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /reviewed_at/);
});

test("a missing learner email releases the claim rather than leaving it stuck", () => {
  const block = SOURCE.match(/if \(!learnerProfile \|\| !learnerEmail\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(block, "missing-learner-email block not found");
  assert.match(block!, /await releaseClaim\(supabase, submissionId\);/);
  assert.match(block!, /reason: "no_learner_email"/);
});

test("a send failure releases the claim and never sets sent_at", () => {
  const block = SOURCE.match(/if \(!result\.success\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(block, "send-failure block not found");
  assert.match(block!, /await releaseClaim\(supabase, submissionId\);/);
  assert.doesNotMatch(block!, /review_returned_email_sent_at/);
});

test("a successful send sets sent_at and clears claimed_at together in the same update", () => {
  const successUpdate = SOURCE.match(/\.update\(\{\s*review_returned_email_sent_at: new Date\(\)\.toISOString\(\),\s*review_returned_email_claimed_at: null,\s*\}\)/)?.[0];
  assert.ok(successUpdate, "success update not found");
});

test("the reviewed-work link is built from getAbsoluteAppUrl(`/your-work/${submissionId}`), never a bare /home or list route", () => {
  assert.match(SOURCE, /getAbsoluteAppUrl\(`\/your-work\/\$\{submissionId\}`\)/);
});

test("the learner is resolved via the existing getLearnerProfileByAuthUserId, never a duplicated query", () => {
  assert.match(SOURCE, /import \{ getLearnerProfileByAuthUserId \} from "@\/lib\/supabase\/learnerProfile";/);
  assert.match(SOURCE, /getLearnerProfileByAuthUserId\(learnerId\)/);
});

test("the email is sent through sendEmail() only -- Resend is never imported or instantiated directly in this file", () => {
  assert.match(SOURCE, /import \{ sendEmail \} from "@\/lib\/email\/sendEmail";/);
  assert.doesNotMatch(SOURCE, /from "resend"/);
  assert.doesNotMatch(SOURCE, /new Resend\(/);
});

test("an unexpected error anywhere after the claim is caught and releases the claim, never crashing the caller", () => {
  const catchBlock = SOURCE.match(/\} catch \(error\) \{\s*console\.error\("Unexpected error while sending review-return email:"[\s\S]*?\n  \}/)?.[0];
  assert.ok(catchBlock, "outer catch block not found");
  assert.match(catchBlock!, /await releaseClaim\(supabase, submissionId\);/);
});

test("no learner email, API key, or full profile is ever logged -- only submissionId and a message string", () => {
  const logCalls = SOURCE.match(/console\.error\([^;]*?\}\);/g) ?? [];
  assert.ok(logCalls.length >= 3);
  for (const call of logCalls) {
    assert.doesNotMatch(call, /learnerEmail|learnerProfile\b|RESEND_API_KEY/);
  }
});

// --- Mirrored race-condition model -----------------------------------
// Simulates the exact SQL-level guarantee the real claim update relies
// on: a conditional UPDATE ... WHERE sent_at IS NULL AND claimed_at IS
// NULL can only ever be won once per row, because the losing request's
// WHERE clause no longer matches after the winner's write lands. This is
// tested here as a plain function since two real concurrent Postgres
// requests cannot be reproduced in a node:test run.

type FakeRow = { sentAt: string | null; claimedAt: string | null };

function tryClaim(row: FakeRow, now: string): { claimed: boolean; row: FakeRow } {
  if (row.sentAt !== null || row.claimedAt !== null) {
    return { claimed: false, row };
  }
  return { claimed: true, row: { ...row, claimedAt: now } };
}

function tryMarkSent(row: FakeRow, now: string): FakeRow {
  return { ...row, sentAt: now, claimedAt: null };
}

function releaseClaimRow(row: FakeRow): FakeRow {
  return { ...row, claimedAt: null };
}

test("first request wins the atomic claim on a fresh row", () => {
  const fresh: FakeRow = { sentAt: null, claimedAt: null };
  const result = tryClaim(fresh, "2026-08-31T10:00:00.000Z");
  assert.equal(result.claimed, true);
  assert.equal(result.row.claimedAt, "2026-08-31T10:00:00.000Z");
});

test("a concurrent duplicate claim against the now-claimed row loses safely", () => {
  const fresh: FakeRow = { sentAt: null, claimedAt: null };
  const first = tryClaim(fresh, "2026-08-31T10:00:00.000Z");
  assert.equal(first.claimed, true);

  // The second request reads/acts on the row AFTER the first request's
  // write has landed -- exactly what the real WHERE clause guarantees.
  const second = tryClaim(first.row, "2026-08-31T10:00:00.050Z");
  assert.equal(second.claimed, false);
});

test("a historical returned row (both columns null, but never actually claimed by this feature) is structurally claimable in isolation -- proving the NO-BACKFILL protection lives in the caller's isFirstReturn gate, not in this claim function itself", () => {
  const historicalRow: FakeRow = { sentAt: null, claimedAt: null };
  const result = tryClaim(historicalRow, "2026-08-31T10:00:00.000Z");
  // This is intentionally true: sendReviewReturnedEmailIfDue must simply
  // never be CALLED for a historical row. See the route-level test
  // confirming the call is gated on isFirstReturn.
  assert.equal(result.claimed, true);
});

test("a successful send transitions the row to sent_at set, claimed_at cleared", () => {
  const claimed: FakeRow = { sentAt: null, claimedAt: "2026-08-31T10:00:00.000Z" };
  const sent = tryMarkSent(claimed, "2026-08-31T10:00:01.000Z");
  assert.equal(sent.sentAt, "2026-08-31T10:00:01.000Z");
  assert.equal(sent.claimedAt, null);
});

test("a released (failed) claim returns to both-null, allowing a future controlled retry", () => {
  const claimed: FakeRow = { sentAt: null, claimedAt: "2026-08-31T10:00:00.000Z" };
  const released = releaseClaimRow(claimed);
  assert.equal(released.sentAt, null);
  assert.equal(released.claimedAt, null);
  // And is claimable again afterwards.
  const reclaim = tryClaim(released, "2026-08-31T10:05:00.000Z");
  assert.equal(reclaim.claimed, true);
});

test("a row that already has sent_at set can never be re-claimed, even if claimed_at is null", () => {
  const alreadySent: FakeRow = { sentAt: "2026-08-31T09:00:00.000Z", claimedAt: null };
  const attempt = tryClaim(alreadySent, "2026-08-31T10:00:00.000Z");
  assert.equal(attempt.claimed, false);
});

// --- AD ASTRA REVIEW-RETURN EMAIL RELIABILITY REPAIR ------------------
// Persisted delivery-history assertions. Every genuine attempt outcome
// (sent/failed/skipped) must be recorded via recordActivityReviewEmailDelivery
// -- except the lost-race/idempotent "already_claimed_or_sent" no-op,
// which is deliberately excluded (see that branch's own comment) so the
// audit table stays meaningful rather than filling with noise.

test("a claim-step database error is persisted as a failed delivery, with no activity/subject/recipient known yet", () => {
  const block = SOURCE.match(/\} catch \(error\) \{\s*const message[\s\S]*?return \{ sent: false, reason: "claim_failed" \};\s*\n  \}/)?.[0];
  assert.ok(block, "claim-failure block not found");
  assert.match(block!, /status: "failed",/);
  assert.match(block!, /reason: `claim_failed: \$\{message\}`,/);
  assert.match(block!, /activityId: null,/);
  assert.match(block!, /subjectId: null,/);
  assert.match(block!, /recipientEmail: null,/);
});

test("the lost-race/idempotent re-entry ('already_claimed_or_sent') is NEVER persisted to the delivery-history table -- only logged structurally by the caller, to keep the audit trail meaningful rather than noisy", () => {
  const skipBlock = SOURCE.match(/if \(!claimedRow\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(skipBlock);
  assert.doesNotMatch(skipBlock!, /recordActivityReviewEmailDelivery/);
});

test("a missing learner email is persisted as a SKIPPED delivery (not failed) -- this is a legitimate reason a notification should not proceed, not a system failure", () => {
  const block = SOURCE.match(/if \(!learnerProfile \|\| !learnerEmail\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(block);
  assert.match(block!, /recordActivityReviewEmailDelivery\(\{/);
  assert.match(block!, /status: "skipped",/);
  assert.match(block!, /reason: "no_learner_email",/);
  assert.match(block!, /recipientEmail: null,/);
});

test("an activity-resolution failure is persisted as a SKIPPED delivery, with the resolved recipient email included even though the subject could not be resolved", () => {
  const block = SOURCE.match(/if \(!subjectAndActivity\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(block);
  assert.match(block!, /recordActivityReviewEmailDelivery\(\{/);
  assert.match(block!, /status: "skipped",/);
  assert.match(block!, /reason: "activity_resolution_failed",/);
  assert.match(block!, /recipientEmail: learnerEmail,/);
  assert.match(block!, /subjectId: null,/);
});

test("a provider send failure is persisted as a FAILED delivery with the sanitized provider error as the reason, and the claim is released", () => {
  const block = SOURCE.match(/if \(!result\.success\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(block);
  assert.match(block!, /await releaseClaim\(supabase, submissionId\);/);
  assert.match(block!, /recordActivityReviewEmailDelivery\(\{/);
  assert.match(block!, /status: "failed",/);
  assert.match(block!, /reason: result\.error,/);
  assert.doesNotMatch(block!, /review_returned_email_sent_at/);
});

test("a successful send is persisted as a SENT delivery, including the provider message id, in the same call that marks sent_at", () => {
  const successIndex = SOURCE.indexOf("return { sent: true };");
  const priorSlice = SOURCE.slice(SOURCE.indexOf('if (markSentError) {'), successIndex);
  assert.match(priorSlice, /recordActivityReviewEmailDelivery\(\{/);
  assert.match(priorSlice, /status: "sent",/);
  assert.match(priorSlice, /providerMessageId: result\.id,/);
});

test("an unexpected error anywhere after the claim is persisted as a FAILED delivery with a sanitized reason, in addition to releasing the claim", () => {
  const catchBlock = SOURCE.match(/\} catch \(error\) \{\s*console\.error\("Unexpected error while sending review-return email:"[\s\S]*?\n  \}/)?.[0];
  assert.ok(catchBlock, "outer catch block not found");
  assert.match(catchBlock!, /recordActivityReviewEmailDelivery\(\{/);
  assert.match(catchBlock!, /status: "failed",/);
  assert.match(catchBlock!, /reason: `unexpected_error: /);
});

test("resolveSubjectAndActivity now also resolves subjectId (from the snapshot or the live lesson join) alongside subjectName/activityTitle -- required so a delivery row can be linked to its subject", () => {
  assert.match(SOURCE, /subjectId: snapshot\.subject\.id,/);
  assert.match(SOURCE, /subjectId: lesson\.subject_id,/);
});

test("delivery persistence is imported from the dedicated repository, never a direct inline insert into activity_review_email_deliveries", () => {
  assert.match(
    SOURCE,
    /import \{ recordActivityReviewEmailDelivery \} from "@\/lib\/email\/activityReviewEmailDeliveryRepository";/,
  );
  assert.doesNotMatch(SOURCE, /\.from\("activity_review_email_deliveries"\)/);
});
