import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

export { isMissingStoreRedemptionsTableError } from "@/lib/supabase/storeRedemptionErrors";

// AD Astra Store -- Stage B. Thin TypeScript wrapper around the two SQL
// RPCs added by supabase/migrations/202610160003_request_store_redemption_rpc.sql
// and .../202610160004_admin_decline_store_redemption_rpc.sql. Neither
// RPC accepts a learner/actor id parameter -- both resolve the caller
// entirely from auth.uid() inside Postgres, so the client invoking them
// matters: see requestStoreRedemption()'s own comment below.

export type StoreRedemptionStatus =
  | "pending"
  | "approved"
  | "fulfilled"
  | "declined"
  | "cancelled";

export type StoreRedemptionRow = {
  id: string;
  learner_id: string;
  catalogue_item_id: string;
  provider: string;
  rand_value: number;
  coin_cost: number;
  status: StoreRedemptionStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  deduction_transaction_id: string;
  refund_transaction_id: string | null;
};

export type RequestStoreRedemptionFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACTIVE_LEARNER_REQUIRED"
  | "STORE_CLOSED"
  | "UNKNOWN_CATALOGUE_ITEM"
  | "ALREADY_PENDING_FOR_ITEM"
  | "INSUFFICIENT_BALANCE"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "UNKNOWN_ERROR";

export type RequestStoreRedemptionResult =
  | {
      success: true;
      redemptionId: string;
      transactionId: string;
      newBalance: number;
      status: string;
    }
  | { success: false; code: RequestStoreRedemptionFailureCode; error: string };

const REQUEST_RPC_FAILURE_CODES: Record<string, RequestStoreRedemptionFailureCode> = {
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  ACTIVE_LEARNER_REQUIRED: "ACTIVE_LEARNER_REQUIRED",
  STORE_CLOSED: "STORE_CLOSED",
  UNKNOWN_CATALOGUE_ITEM: "UNKNOWN_CATALOGUE_ITEM",
  ALREADY_PENDING_FOR_ITEM: "ALREADY_PENDING_FOR_ITEM",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
};

// IMPORTANT: this calls request_store_redemption() through the LEARNER'S
// OWN request-scoped client (createSupabaseRequestClient(), carrying
// their real session cookie/JWT) -- deliberately never
// createSupabaseAdminClient(). The RPC resolves the learner from
// auth.uid() itself; a service-role call carries no end-user JWT "sub"
// claim, so auth.uid() would be null inside the function and the
// ACTIVE_LEARNER_REQUIRED check would reject every call. (This is also
// why the function is GRANTed EXECUTE to `authenticated`, not merely
// callable by service-role -- the real end-user session is the intended
// caller.)
export async function requestStoreRedemption(
  catalogueItemId: string,
  idempotencyKey: string,
): Promise<RequestStoreRedemptionResult> {
  const supabase = await createSupabaseRequestClient();

  const { data, error } = await supabase.rpc("request_store_redemption", {
    p_catalogue_item_id: catalogueItemId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const code = REQUEST_RPC_FAILURE_CODES[error.message] ?? "UNKNOWN_ERROR";
    return { success: false, code, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      success: false,
      code: "UNKNOWN_ERROR",
      error: "The redemption request did not return a result.",
    };
  }

  return {
    success: true,
    redemptionId: row.redemption_id,
    transactionId: row.transaction_id,
    newBalance: row.new_balance,
    status: row.status,
  };
}

// Reads via the admin client filtered by an already-resolved
// learnerAuthUserId -- matching getLearnerCoinTransactions()'s own
// established convention -- rather than relying on the table's RLS
// policy, which exists as a defence-in-depth backstop, not this
// function's actual access control.
//
// Always THROWS on any error (missing table, permissions, network,
// anything) -- it never catches one itself and never returns an empty
// array to mean "failed to load". A caller must not treat an empty
// result from here as ambiguous: an empty array from this function
// means the query genuinely succeeded with zero rows. Distinguishing
// "genuinely empty" from "failed to load" (including the expected
// pre-migration missing-table case) is the caller's job, using
// isMissingStoreRedemptionsTableError() above to react to that one
// specific, expected condition differently from any other.
export async function getLearnerStoreRedemptions(
  learnerAuthUserId: string,
): Promise<StoreRedemptionRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("store_redemptions")
    .select("*")
    .eq("learner_id", learnerAuthUserId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as StoreRedemptionRow[];
}

// Reads the server-controlled Store availability flag -- never a
// client-controlled value. Used for display only (e.g. the Store page's
// "funding/availability status"); request_store_redemption() re-checks
// this itself and is the actual enforcement point.
export async function isStoreRedemptionAvailable(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select("redemptions_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data?.redemptions_enabled === true;
}

export type AdminDeclineStoreRedemptionFailureCode =
  | "ADMINISTRATOR_REQUIRED"
  | "UNSUPPORTED_STATUS"
  | "REASON_REQUIRED"
  | "REDEMPTION_NOT_FOUND"
  | "REDEMPTION_NOT_PENDING"
  | "UNKNOWN_ERROR";

export type AdminDeclineStoreRedemptionResult =
  | {
      success: true;
      redemptionId: string;
      transactionId: string;
      newBalance: number;
      status: string;
    }
  | { success: false; code: AdminDeclineStoreRedemptionFailureCode; error: string };

const DECLINE_RPC_FAILURE_CODES: Record<string, AdminDeclineStoreRedemptionFailureCode> = {
  ADMINISTRATOR_REQUIRED: "ADMINISTRATOR_REQUIRED",
  UNSUPPORTED_STATUS: "UNSUPPORTED_STATUS",
  REASON_REQUIRED: "REASON_REQUIRED",
  REDEMPTION_NOT_FOUND: "REDEMPTION_NOT_FOUND",
  REDEMPTION_NOT_PENDING: "REDEMPTION_NOT_PENDING",
};

// Not called from any route or UI yet in Stage B -- provided only so a
// future admin review workflow has an atomic, safe primitive to call.
// Same calling-convention requirement as requestStoreRedemption(): the
// ADMINISTRATOR'S OWN request-scoped client, never the admin/service-role
// client, since this RPC also resolves its caller from auth.uid().
export async function adminDeclineStoreRedemption(
  redemptionId: string,
  newStatus: "declined" | "cancelled",
  reason: string,
): Promise<AdminDeclineStoreRedemptionResult> {
  const supabase = await createSupabaseRequestClient();

  const { data, error } = await supabase.rpc("admin_decline_store_redemption", {
    p_redemption_id: redemptionId,
    p_new_status: newStatus,
    p_reason: reason,
  });

  if (error) {
    const code = DECLINE_RPC_FAILURE_CODES[error.message] ?? "UNKNOWN_ERROR";
    return { success: false, code, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      success: false,
      code: "UNKNOWN_ERROR",
      error: "The decline/refund operation did not return a result.",
    };
  }

  return {
    success: true,
    redemptionId: row.redemption_id,
    transactionId: row.transaction_id,
    newBalance: row.new_balance,
    status: row.status,
  };
}
