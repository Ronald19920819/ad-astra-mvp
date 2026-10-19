import { NextResponse } from "next/server";
import { STORE_CATALOGUE } from "@/lib/store/storeCatalogue";
import { requestStoreRedemption } from "@/lib/supabase/storeRedemptions";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_CATALOGUE_ITEM_IDS = new Set(STORE_CATALOGUE.map((item) => item.id));

function invalid(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 });
}

// AD ASTRA STORE -- STAGE B. The one write path a learner can reach for
// a redemption request. This route never resolves the learner itself and
// never passes a learner id anywhere -- requestStoreRedemption() calls
// the RPC through the caller's own session, and the RPC resolves
// auth.uid() entirely inside Postgres. This route's own job is strictly
// limited to: reject an obviously malformed payload with a clear 400
// before touching the database at all, map the RPC's typed failure codes
// to honest HTTP responses, and never leak internal database detail.
//
// CRITICAL FUNDING SAFEGUARD (Stage B): store_settings.redemptions_enabled
// defaults to false and nothing in this route or its RPC flips it --
// every call today resolves to STORE_CLOSED (409) unless that row is
// changed directly in the database by someone with service-role access.
// There is no request parameter, header, or client state that can
// bypass this -- availability is checked by the RPC itself, not by this
// route's own logic, so this route cannot be tricked into skipping that
// check even if it tried to.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Malformed JSON request body.", "MALFORMED_JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("Invalid redemption request.", "INVALID_REQUEST");
  }

  const { catalogueItemId, idempotencyKey } = body as Record<string, unknown>;

  if (typeof catalogueItemId !== "string" || !VALID_CATALOGUE_ITEM_IDS.has(catalogueItemId)) {
    return invalid("Unknown catalogue item.", "INVALID_CATALOGUE_ITEM");
  }
  if (typeof idempotencyKey !== "string" || !uuidPattern.test(idempotencyKey)) {
    return invalid("A valid idempotency key is required.", "INVALID_IDEMPOTENCY_KEY");
  }

  try {
    const result = await requestStoreRedemption(catalogueItemId, idempotencyKey);

    if (!result.success) {
      if (result.code === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          { error: "Learner sign-in is required.", code: result.code },
          { status: 401 },
        );
      }
      if (result.code === "ACTIVE_LEARNER_REQUIRED") {
        return NextResponse.json(
          { error: "An active learner account is required.", code: result.code },
          { status: 403 },
        );
      }
      if (result.code === "STORE_CLOSED") {
        return NextResponse.json(
          { error: "Store redemptions are not yet available.", code: result.code },
          { status: 409 },
        );
      }
      if (result.code === "INSUFFICIENT_BALANCE") {
        return NextResponse.json(
          {
            error: "You do not have enough Ad Astra Coins for this reward.",
            code: result.code,
          },
          { status: 409 },
        );
      }
      if (result.code === "ALREADY_PENDING_FOR_ITEM") {
        return NextResponse.json(
          {
            error: "You already have a pending request for this reward.",
            code: result.code,
          },
          { status: 409 },
        );
      }

      console.error("Store redemption request rejected by the ledger:", {
        code: result.code,
        message: result.error,
      });
      return NextResponse.json(
        { error: "Unable to process this redemption request.", code: result.code },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      redemptionId: result.redemptionId,
      newBalance: result.newBalance,
      status: result.status,
    });
  } catch (error) {
    console.error("Unable to process Store redemption request:", error);
    return NextResponse.json(
      { error: "Unable to process this redemption request. Please try again.", code: "REQUEST_FAILED" },
      { status: 500 },
    );
  }
}
