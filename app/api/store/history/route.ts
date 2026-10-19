import { NextResponse } from "next/server";
import { getCurrentLearnerContext } from "@/lib/supabase/currentLearnerContext";
import { getLearnerStoreRedemptions } from "@/lib/supabase/storeRedemptions";

// AD ASTRA STORE -- STAGE B. Read-only: returns only the authenticated
// learner's OWN redemption requests, resolved via the canonical
// getCurrentLearnerContext() -- never a client-supplied learner id, and
// never another learner's rows (getLearnerStoreRedemptions filters by
// this exact resolved id; store_redemptions' own RLS policy is a
// defence-in-depth backstop behind this, not the only thing enforcing
// it here).
export async function GET() {
  const context = await getCurrentLearnerContext();

  if (context.status !== "success") {
    return NextResponse.json({ error: context.message, code: context.code }, { status: 401 });
  }

  try {
    const redemptions = await getLearnerStoreRedemptions(context.identity.learnerId);
    return NextResponse.json({ redemptions });
  } catch (error) {
    console.error("Unable to load learner Store redemption history:", error);
    return NextResponse.json(
      { error: "Unable to load your redemption history.", code: "HISTORY_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
