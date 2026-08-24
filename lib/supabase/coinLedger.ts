import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// THE authoritative write path for the AD Astra Coin ledger
// (public.coin_transactions -- see
// supabase/migrations/202608220001_coin_ledger.sql). Every function here
// inserts exactly one immutable, signed transaction row; none of them
// update or delete an existing row, and none of them accept a
// client-supplied balance or amount override -- amounts are always
// computed server-side from lib/rewards/coinRules.ts.
export type CoinTransactionType =
  | "lesson_activity_reward"
  | "admin_adjustment"
  | "store_redemption"
  | "ad_astra_contribution"
  | "correction"
  | "competition_award"
  | "promotional_award"
  | "special_achievement";

export type CoinTransactionRow = {
  id: string;
  learner_id: string;
  amount: number;
  transaction_type: CoinTransactionType;
  subject_id: string | null;
  lesson_id: string | null;
  activity_id: string | null;
  activity_submission_id: string | null;
  reference_transaction_id: string | null;
  actor_type: "system" | "admin" | "teacher";
  actor_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// balance = SUM(amount) over the learner's own ledger rows -- the ONE
// authoritative way to obtain a Coin balance. No materialised/cached
// balance field exists (Stage 3 decision, mirroring Stage 1's XP
// architecture): with the transaction volume this system will realistically
// have, a live aggregate is simple, always consistent by construction, and
// avoids a second piece of state that could drift from the ledger.
export async function getLearnerCoinBalance(
  learnerAuthUserId: string,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("amount")
    .eq("learner_id", learnerAuthUserId);

  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

export async function getLearnerCoinTransactions(
  learnerAuthUserId: string,
): Promise<CoinTransactionRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("*")
    .eq("learner_id", learnerAuthUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CoinTransactionRow[];
}

export type RecordPairRewardParams = {
  learnerAuthUserId: string;
  subjectId: string;
  lessonId: string;
  activityId: string;
  activitySubmissionId: string;
  // Must be lib/rewards/coinRules.ts's calculatePairCoins(...).finalCoins
  // for a QUALIFYING pair (> 0) -- callers must never call this for a
  // non-qualifying pair.
  amount: number;
  // Frozen calculation detail: teacher-final percentage, frozen mark
  // denominator, base/bonus/lateDeduction breakdown, due date, days late,
  // lesson/activity titles at award time, etc. Kept so the transaction
  // stays explainable even if the activity is edited afterwards.
  metadata: Record<string, unknown>;
  // A short, human-readable line for a future Coin Statement (e.g.
  // "Activity 6 - Lesson 3.6") -- stored in the ledger's own `reason`
  // column, not just buried in metadata, since it's plain display text a
  // statement can show directly. Optional so existing/future callers that
  // don't have it yet aren't forced to supply one.
  reason?: string;
};

export type RecordPairRewardResult =
  | { inserted: true; transactionId: string }
  | { inserted: false; transactionId: null };

// Idempotent by construction: coin_transactions_pair_reward_idempotency_idx
// is a database-level UNIQUE index on (learner_id, activity_submission_id)
// scoped to transaction_type = 'lesson_activity_reward'. A second call for
// the same learner+submission (page refresh, duplicate request, repeated
// teacher review, redeploy, concurrent request, retry) hits a unique
// violation (Postgres error 23505), which is treated as an idempotent
// no-op here rather than an error -- the guarantee lives in the database,
// not in application-level "check then insert" logic (which cannot be
// race-safe under concurrent requests).
export async function recordLessonActivityPairReward(
  params: RecordPairRewardParams,
): Promise<RecordPairRewardResult> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error(
      "recordLessonActivityPairReward requires a positive integer amount -- " +
        "non-qualifying pairs (calculatePairCoins().finalCoins === 0) must never call this.",
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coin_transactions")
    .insert({
      learner_id: params.learnerAuthUserId,
      amount: params.amount,
      transaction_type: "lesson_activity_reward",
      subject_id: params.subjectId,
      lesson_id: params.lessonId,
      activity_id: params.activityId,
      activity_submission_id: params.activitySubmissionId,
      actor_type: "system",
      metadata: params.metadata,
      reason: params.reason?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { inserted: false, transactionId: null };
    }
    throw error;
  }

  return { inserted: true, transactionId: data.id };
}

export type RecordCorrectionParams = {
  learnerAuthUserId: string;
  referenceTransactionId: string;
  // Signed -- e.g. -100 to reduce an original +800 award down to 700.
  amount: number;
  reason: string;
  actorType: "admin" | "system";
  actorId?: string | null;
};

// Architecture for later stages (locked requirement: corrections must
// never delete or overwrite the original transaction). Not called by any
// route or script in Stage 3 -- this is the write primitive a future
// authorised correction flow will call.
export async function recordCorrection(
  params: RecordCorrectionParams,
): Promise<{ transactionId: string }> {
  if (params.amount === 0) {
    throw new Error("recordCorrection requires a non-zero signed amount.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coin_transactions")
    .insert({
      learner_id: params.learnerAuthUserId,
      amount: params.amount,
      transaction_type: "correction",
      reference_transaction_id: params.referenceTransactionId,
      actor_type: params.actorType,
      actor_id: params.actorId ?? null,
      reason: params.reason,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { transactionId: data.id };
}

export type RecordAdminAdjustmentParams = {
  learnerAuthUserId: string;
  amount: number; // signed
  reason: string;
  actorId: string; // the admin's auth user id -- never optional
};

// Architecture-only for Stage 3 (locked requirement: "DO NOT build the
// full Admin UI ... establishing the ledger architecture first"). No admin
// route calls this yet.
export async function recordAdminAdjustment(
  params: RecordAdminAdjustmentParams,
): Promise<{ transactionId: string }> {
  if (params.amount === 0) {
    throw new Error("recordAdminAdjustment requires a non-zero signed amount.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coin_transactions")
    .insert({
      learner_id: params.learnerAuthUserId,
      amount: params.amount,
      transaction_type: "admin_adjustment",
      actor_type: "admin",
      actor_id: params.actorId,
      reason: params.reason,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { transactionId: data.id };
}
