import "server-only";

import { previewLearnerCoinHistory } from "@/lib/supabase/coinEarningEngine";
import { recordLessonActivityPairReward } from "@/lib/supabase/coinLedger";

// THE live Coin-reward trigger. Before this file existed, NOTHING in the
// application ever called coinLedger.ts::recordLessonActivityPairReward --
// coinEarningEngine.ts is deliberately read-only (see its own header
// comment), and the one place that historically called the write function
// was the Stage 6 one-time backfill route, which was deleted after use.
// Every pair completed since then earned 0 Coins regardless of due dates,
// marks, or Coin Gate state, simply because nothing ever ran the
// calculation+write for a newly-qualifying pair.
//
// Call this once, right after a submission's teacher-final mark is
// recorded (app/api/teacher/business-studies/reviews/[submissionId]/route.ts)
// -- the exact moment "spendable Coins" become possible for that pair,
// matching the locked "teacher-final mark required" policy. Never call it
// for a still-AI-preliminary mark.
//
// Reuses previewLearnerCoinHistory's own, already-tested calculation --
// Coin Gate status, due-date/lateness derivation, the two legacy
// exceptions, and calculatePairCoins -- rather than re-implementing any of
// it. This function only adds the write step coinEarningEngine.ts is
// deliberately never allowed to perform itself.
export type PairRewardTriggerResult =
  | { awarded: true; amount: number; transactionId: string }
  | { awarded: false; reason: string };

export async function evaluateAndRecordPairReward(
  learnerAuthUserId: string,
  activitySubmissionId: string,
): Promise<PairRewardTriggerResult> {
  const preview = await previewLearnerCoinHistory(learnerAuthUserId);
  const pair = preview.pairs.find(
    (candidate) => candidate.activitySubmissionId === activitySubmissionId,
  );

  if (!pair) {
    return { awarded: false, reason: "not_a_qualifying_linked_pair" };
  }
  if (pair.ineligibleReason) {
    return { awarded: false, reason: pair.ineligibleReason };
  }
  if (!pair.coinResult || pair.coinResult.finalCoins <= 0) {
    return { awarded: false, reason: "zero_coin_result" };
  }

  const result = await recordLessonActivityPairReward({
    learnerAuthUserId,
    amount: pair.coinResult.finalCoins,
    subjectId: pair.subjectId,
    lessonId: pair.lessonId,
    activityId: pair.activityId,
    activitySubmissionId: pair.activitySubmissionId,
    reason: `${pair.lessonTitle} / ${pair.activityTitle}`,
    metadata: {
      pairCompletionTimestamp: pair.pairCompletionTimestamp,
      dueDate: pair.dueDate,
      dueDateBasis: pair.dueDateBasis,
      percentage: pair.percentage,
      daysLate: pair.daysLate,
      baseCoins: pair.coinResult.baseCoins,
      finalCoins: pair.coinResult.finalCoins,
    },
  });

  if (!result.inserted) {
    // Idempotent no-op: a transaction for this exact learner+submission
    // already exists (the DB's own partial unique index) -- never a
    // duplicate award, e.g. if a review is somehow re-submitted.
    return { awarded: false, reason: "already_recorded" };
  }

  return {
    awarded: true,
    amount: pair.coinResult.finalCoins,
    transactionId: result.transactionId,
  };
}
