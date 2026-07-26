import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { getLearnerJourney } from "@/lib/supabase/learnerJourney";
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

    return Response.json({ profile, journey });
  } catch (error) {
    logSupabaseError("Unable to load authenticated learner profile page:", error);
    return Response.json(
      { error: "Unable to load your learner profile." },
      { status: 500 },
    );
  }
}
