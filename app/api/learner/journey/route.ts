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

    const journey = await getLearnerJourney(profile);
    return Response.json({ journey });
  } catch (error) {
    logSupabaseError("Unable to load authenticated learner journey:", error);
    return Response.json(
      { error: "Unable to load your learner journey." },
      { status: 500 },
    );
  }
}
