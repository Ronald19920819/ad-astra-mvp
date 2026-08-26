import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { getLearnerJourney } from "@/lib/supabase/learnerJourney";
import { getLearnerRewardsSummary } from "@/lib/supabase/learnerRewardsSummary";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

export async function GET() {
  try {
    const profile = await getAuthenticatedLearnerProfile();

    if (!profile) {
      return Response.json(
        { error: "Learner profile unavailable." },
        { status: 401 },
      );
    }

    let journey = null;
    try {
      journey = await getLearnerJourney(profile);
    } catch (error) {
      logSupabaseError(
        "Unable to load authenticated learner Journey:",
        error,
      );
    }

    // Same canonical assembler the XP & Coins dashboard uses -- Profile's
    // summary card must never compute XP/AC/Coin Gate state independently.
    // Only xp/acBalance are sent over the wire here: Profile is a status
    // snapshot only and never renders the transaction list, so the full
    // history isn't worth the payload.
    type RewardsSummary = Awaited<ReturnType<typeof getLearnerRewardsSummary>>;
    let rewards: Pick<RewardsSummary, "xp" | "acBalance"> | null = null;
    try {
      const fullSummary = await getLearnerRewardsSummary(profile.userId);
      rewards = { xp: fullSummary.xp, acBalance: fullSummary.acBalance };
    } catch (error) {
      logSupabaseError(
        "Unable to load authenticated learner rewards summary:",
        error,
      );
    }

    return Response.json({ profile, journey, rewards });
  } catch (error) {
    logSupabaseError("Unable to load authenticated learner profile page:", error);
    return Response.json(
      { error: "Unable to load your learner profile." },
      { status: 500 },
    );
  }
}
