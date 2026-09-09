import { NextResponse } from "next/server";
import {
  authorizeAdministrator,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  recordAdminCoinAdjustment,
  type AdminAdjustableCoinTransactionType,
} from "@/lib/supabase/coinLedger";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_CATEGORIES: readonly AdminAdjustableCoinTransactionType[] = [
  "admin_adjustment",
  "correction",
  "competition_award",
  "promotional_award",
  "special_achievement",
];

const MAX_AMOUNT = 1_000_000; // generous, not an arbitrary small cap -- just guards against a pathological payload
const MAX_REASON_LENGTH = 500; // matches coin_transactions.reason's own CHECK constraint
const MAX_NOTE_LENGTH = 2000;

function invalid(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 });
}

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2. The one write path
// for a manual Coin adjustment/correction. The client submits ONLY:
// adjustmentType ("add"/"subtract"), a positive amount, a category, a
// reason, an optional admin note, and (for "correction" only) a
// referenceTransactionId -- it can never submit a signed amount, an
// actor identity, a restricted transaction type, or a "resulting
// balance"; every one of those is derived or enforced server-side (this
// route converts adjustmentType+amount into the signed amount; the
// admin_adjust_learner_coins() RPC derives actor identity from the
// caller's own session and is the sole place the resulting balance is
// computed).
export async function POST(
  request: Request,
  context: { params: Promise<{ learnerId: string }> },
) {
  const { learnerId } = await context.params;
  if (!uuidPattern.test(learnerId)) {
    return invalid("A valid learner ID is required.", "INVALID_LEARNER_ID");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Malformed JSON request body.", "MALFORMED_JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("Invalid adjustment request.", "INVALID_REQUEST");
  }

  const payload = body as Record<string, unknown>;
  const { adjustmentType, amount, category, reason, adminNote, referenceTransactionId } = payload;

  if (adjustmentType !== "add" && adjustmentType !== "subtract") {
    return invalid("Adjustment type must be 'add' or 'subtract'.", "INVALID_ADJUSTMENT_TYPE");
  }

  // The UI never asks the administrator to type a negative number --
  // `amount` must always be a positive whole number; the sign comes
  // entirely from adjustmentType, decided below.
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    Number.isNaN(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return invalid(
      `Amount must be a whole positive number of Coins (up to ${MAX_AMOUNT.toLocaleString("en-ZA")}).`,
      "INVALID_AMOUNT",
    );
  }

  if (typeof category !== "string" || !ALLOWED_CATEGORIES.includes(category as AdminAdjustableCoinTransactionType)) {
    return invalid(
      "Category must be one of admin_adjustment, correction, competition_award, promotional_award, special_achievement.",
      "INVALID_CATEGORY",
    );
  }

  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > MAX_REASON_LENGTH) {
    return invalid(
      `A reason is required (up to ${MAX_REASON_LENGTH} characters).`,
      "REASON_REQUIRED",
    );
  }

  if (
    adminNote !== undefined &&
    adminNote !== null &&
    (typeof adminNote !== "string" || adminNote.length > MAX_NOTE_LENGTH)
  ) {
    return invalid(`Admin note must be text up to ${MAX_NOTE_LENGTH} characters.`, "INVALID_NOTE");
  }

  const transactionType = category as AdminAdjustableCoinTransactionType;

  // coin_transactions' own CHECK constraint requires reference_transaction_id
  // whenever transaction_type = 'correction' -- validated here up front for
  // a clear message, and re-enforced by the database regardless.
  let resolvedReferenceTransactionId: string | null = null;
  if (transactionType === "correction") {
    if (typeof referenceTransactionId !== "string" || !uuidPattern.test(referenceTransactionId)) {
      return invalid(
        "Select the transaction this correction relates to.",
        "REFERENCE_TRANSACTION_REQUIRED",
      );
    }
    resolvedReferenceTransactionId = referenceTransactionId;
  }

  const authorization = await authorizeAdministrator();
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }
  const { admin } = authorization.teacher;

  try {
    const { data: learnerProfile, error: learnerProfileError } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", learnerId)
      .eq("role", "learner")
      .maybeSingle();
    if (learnerProfileError) throw learnerProfileError;
    if (!learnerProfile) {
      return NextResponse.json(
        { error: "Learner not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // A correction's referenced transaction must genuinely belong to this
    // exact learner -- never trusted merely because the client sent a
    // well-formed UUID for it.
    if (resolvedReferenceTransactionId) {
      const { data: referencedTransaction, error: referencedTransactionError } = await admin
        .from("coin_transactions")
        .select("id")
        .eq("id", resolvedReferenceTransactionId)
        .eq("learner_id", learnerId)
        .maybeSingle();
      if (referencedTransactionError) throw referencedTransactionError;
      if (!referencedTransaction) {
        return invalid(
          "The selected transaction to correct could not be found for this learner.",
          "REFERENCE_TRANSACTION_NOT_FOUND",
        );
      }
    }

    const signedAmount = adjustmentType === "add" ? amount : -amount;

    const result = await recordAdminCoinAdjustment({
      learnerAuthUserId: learnerId,
      amount: signedAmount,
      transactionType,
      reason: reason.trim(),
      referenceTransactionId: resolvedReferenceTransactionId,
      adminNote: typeof adminNote === "string" ? adminNote : null,
    });

    if (!result.success) {
      if (result.code === "INSUFFICIENT_BALANCE") {
        return NextResponse.json(
          {
            error: "This adjustment would reduce the learner's balance below 0 AC.",
            code: "INSUFFICIENT_BALANCE",
          },
          { status: 409 },
        );
      }
      if (result.code === "ADMINISTRATOR_REQUIRED") {
        return NextResponse.json(
          { error: "Administrator access is required.", code: "ADMINISTRATOR_REQUIRED" },
          { status: 403 },
        );
      }
      console.error("Admin Coin adjustment rejected by the ledger:", {
        learnerId,
        code: result.code,
        message: result.error,
      });
      return NextResponse.json(
        { error: "Unable to record this Coin adjustment.", code: result.code },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Unable to record admin Coin adjustment:", { learnerId, error });
    return NextResponse.json(
      { error: "Unable to record this Coin adjustment. Please try again.", code: "ADJUSTMENT_FAILED" },
      { status: 500 },
    );
  }
}
