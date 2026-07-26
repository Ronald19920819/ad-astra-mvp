import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
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

    return Response.json({ profile });
  } catch (error) {
    logSupabaseError("Unable to load authenticated learner profile details:", error);
    return Response.json(
      { error: "Unable to load your learner profile." },
      { status: 500 },
    );
  }
}
