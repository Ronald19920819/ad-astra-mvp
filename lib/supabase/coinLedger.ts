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

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2. The five transaction
// types an administrator may ever manually create -- deliberately
// excludes lesson_activity_reward, store_redemption, and
// ad_astra_contribution, which belong to their own separate system
// workflows and must never be creatable by hand.
export type AdminAdjustableCoinTransactionType =
  | "admin_adjustment"
  | "correction"
  | "competition_award"
  | "promotional_award"
  | "special_achievement";

export type RecordAdminCoinAdjustmentParams = {
  learnerAuthUserId: string;
  // Signed -- the caller (the admin API route) has already converted
  // "Add 500"/"Subtract 300" into +500/-300; this function never accepts
  // an adjustment "direction" separately from the amount.
  amount: number;
  transactionType: AdminAdjustableCoinTransactionType;
  reason: string;
  // Required by coin_transactions' own CHECK constraint whenever
  // transactionType === "correction" (a correction must always reference
  // what it corrects) -- optional for every other type, never mandatory
  // for them.
  referenceTransactionId?: string | null;
  // Optional internal administrative context -- stored under
  // metadata.adminNote (the ledger's existing general-purpose column for
  // exactly this kind of extra structured detail), never in `reason`
  // (which stays the short, learner-relevant explanation) and never as a
  // new dedicated column.
  adminNote?: string | null;
};

export type RecordAdminCoinAdjustmentFailureCode =
  | "ADMINISTRATOR_REQUIRED"
  | "ZERO_AMOUNT"
  | "UNSUPPORTED_TRANSACTION_TYPE"
  | "REASON_REQUIRED"
  | "INSUFFICIENT_BALANCE"
  | "UNKNOWN_ERROR";

export type RecordAdminCoinAdjustmentResult =
  | { success: true; transactionId: string; newBalance: number }
  | { success: false; code: RecordAdminCoinAdjustmentFailureCode; error: string };

const RPC_FAILURE_MESSAGES: Record<string, RecordAdminCoinAdjustmentFailureCode> = {
  ADMINISTRATOR_REQUIRED: "ADMINISTRATOR_REQUIRED",
  ZERO_AMOUNT: "ZERO_AMOUNT",
  UNSUPPORTED_TRANSACTION_TYPE: "UNSUPPORTED_TRANSACTION_TYPE",
  REASON_REQUIRED: "REASON_REQUIRED",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
};

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2. THE write path for
// every manual Coin adjustment/correction -- always exactly one new,
// immutable, signed ledger row; never an update or delete of any existing
// row. Delegates the actual balance check and insert to the
// admin_adjust_learner_coins() database function
// (202609080002_admin_adjust_learner_coins_rpc.sql) rather than doing a
// "read balance, then insert" in application code: two concurrent
// deduction requests for the same learner could otherwise both read the
// same pre-deduction balance and both pass a client-side/application-side
// check, causing an overdraft neither request could detect alone. The RPC
// serialises concurrent calls for the SAME learner via a transaction-
// scoped Postgres advisory lock, so the balance it reads is always
// current relative to any other adjustment already committed for that
// learner. It also independently re-verifies administrator authorization
// and derives actor identity from the caller's own session (auth.uid())
// -- never a client-supplied actor id -- since it is SECURITY DEFINER and
// therefore reachable by anything holding EXECUTE, not only this
// function.
export async function recordAdminCoinAdjustment(
  params: RecordAdminCoinAdjustmentParams,
): Promise<RecordAdminCoinAdjustmentResult> {
  const supabase = createSupabaseAdminClient();

  const metadata: Record<string, unknown> = {};
  if (params.adminNote?.trim()) {
    metadata.adminNote = params.adminNote.trim();
  }

  const { data, error } = await supabase.rpc("admin_adjust_learner_coins", {
    p_learner_id: params.learnerAuthUserId,
    p_amount: params.amount,
    p_transaction_type: params.transactionType,
    p_reason: params.reason,
    p_reference_transaction_id: params.referenceTransactionId ?? null,
    p_metadata: metadata,
  });

  if (error) {
    const code = RPC_FAILURE_MESSAGES[error.message] ?? "UNKNOWN_ERROR";
    return { success: false, code, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { success: false, code: "UNKNOWN_ERROR", error: "The adjustment did not return a result." };
  }

  return {
    success: true,
    transactionId: row.transaction_id,
    newBalance: row.new_balance,
  };
}
