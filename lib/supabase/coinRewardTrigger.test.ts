import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculatePairCoins } from "@/lib/rewards/coinRules";

// coinRewardTrigger.ts imports "server-only" transitively and cannot be
// invoked directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent. These tests:
//   1. exercise the exact decision logic the trigger applies to a
//      previewLearnerCoinHistory() pair (mirrored, since the real function
//      cannot be imported here), and
//   2. assert structural properties of the real source and its call site.

const TRIGGER_SOURCE = readFileSync("lib/supabase/coinRewardTrigger.ts", "utf8");
// AD ASTRA -- REVIEW-RETURN EMAIL RELIABILITY REPAIR: the real
// implementation moved to the canonical, subject-agnostic shared route --
// app/api/teacher/business-studies/reviews/[submissionId]/route.ts is now
// only a thin re-export of it (see that file's own test).
const REVIEW_ROUTE_SOURCE = readFileSync(
  "app/api/teacher/reviews/[submissionId]/route.ts",
  "utf8",
);

type MirroredPair = {
  activitySubmissionId: string;
  ineligibleReason: string | null;
  coinResult: { finalCoins: number } | null;
};

// Mirrors evaluateAndRecordPairReward's decision logic exactly.
function mirroredDecide(pair: MirroredPair | undefined) {
  if (!pair) return { awarded: false as const, reason: "not_a_qualifying_linked_pair" };
  if (pair.ineligibleReason) return { awarded: false as const, reason: pair.ineligibleReason };
  if (!pair.coinResult || pair.coinResult.finalCoins <= 0) {
    return { awarded: false as const, reason: "zero_coin_result" };
  }
  return { awarded: true as const, amount: pair.coinResult.finalCoins };
}

test("R: a pair with the Coin Gate still locked (ineligibleReason 'pre_gate' or 'gate_never_unlocked') is never awarded", () => {
  assert.deepEqual(
    mirroredDecide({ activitySubmissionId: "s1", ineligibleReason: "pre_gate", coinResult: null }),
    { awarded: false, reason: "pre_gate" },
  );
  assert.deepEqual(
    mirroredDecide({ activitySubmissionId: "s1", ineligibleReason: "gate_never_unlocked", coinResult: null }),
    { awarded: false, reason: "gate_never_unlocked" },
  );
});

test("AA: a pair still awaiting the teacher-final mark is never awarded, regardless of the AI-preliminary mark", () => {
  assert.deepEqual(
    mirroredDecide({
      activitySubmissionId: "s1",
      ineligibleReason: "awaiting_teacher_final_mark",
      coinResult: null,
    }),
    { awarded: false, reason: "awaiting_teacher_final_mark" },
  );
});

test("a pair missing an authoritative shared due date is never awarded", () => {
  assert.deepEqual(
    mirroredDecide({
      activitySubmissionId: "s1",
      ineligibleReason: "no_authoritative_due_date",
      coinResult: null,
    }),
    { awarded: false, reason: "no_authoritative_due_date" },
  );
});

test("AC: calling the trigger for a submission with no matching qualifying pair (already recorded, or never qualified) is a safe no-op, never an error", () => {
  assert.deepEqual(mirroredDecide(undefined), {
    awarded: false,
    reason: "not_a_qualifying_linked_pair",
  });
});

test("a qualifying pair with a positive Coin result is awarded for exactly that amount", () => {
  assert.deepEqual(
    mirroredDecide({
      activitySubmissionId: "s1",
      ineligibleReason: null,
      coinResult: { finalCoins: 400 },
    }),
    { awarded: true, amount: 400 },
  );
});

// V. The exact reported incident: 50% (7/14), 1 day late.
test("V: the exact incident calculation -- 50%, 1 day late = 400 AC (500 base + 0 bonus - 100 lateness), matching the locked formula", () => {
  const result = calculatePairCoins({ percentage: 50, daysLate: 1 });
  assert.equal(result.finalCoins, 400);
});

test("AC: recordLessonActivityPairReward's own DB-level idempotency (23505) is relied upon, not re-implemented as a second check-then-insert here", () => {
  assert.match(TRIGGER_SOURCE, /result\.inserted/);
  assert.match(TRIGGER_SOURCE, /already_recorded/);
});

test("the trigger never re-implements the Coin Gate, due-date, or lateness calculation -- it only calls previewLearnerCoinHistory and recordLessonActivityPairReward", () => {
  assert.match(TRIGGER_SOURCE, /import \{ previewLearnerCoinHistory \} from "@\/lib\/supabase\/coinEarningEngine"/);
  assert.match(TRIGGER_SOURCE, /import \{ recordLessonActivityPairReward \} from "@\/lib\/supabase\/coinLedger"/);
  // No CALL to a second calculation function -- only mentioned in a
  // documentation comment above, never invoked as code.
  assert.doesNotMatch(TRIGGER_SOURCE, /performanceBonus\(|calculatePairCoins\(|evaluateCoinGateStatus\(/);
});

test("13: the teacher review route calls the reward trigger only AFTER the final mark is successfully persisted, and never fails the review itself if the reward evaluation throws", () => {
  const updateIndex = REVIEW_ROUTE_SOURCE.indexOf("status: \"returned\"");
  const triggerIndex = REVIEW_ROUTE_SOURCE.indexOf("evaluateAndRecordPairReward(");
  assert.ok(updateIndex > -1 && triggerIndex > -1);
  assert.ok(updateIndex < triggerIndex, "reward evaluation must happen after the submission update");
  assert.match(REVIEW_ROUTE_SOURCE, /try \{\s*const result = await evaluateAndRecordPairReward/);
});
