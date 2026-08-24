import "server-only";

import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import {
  getAuthenticatedLearnerProfile,
  getLearnerProfileByAuthUserId,
} from "@/lib/supabase/learnerProfile";
import {
  getCurrentLearnerIdentity,
  type LearnerIdentityResult,
} from "@/lib/supabase/learnerWorkReader";

// Composes the existing identity resolution (getCurrentLearnerIdentity,
// which already handles real sessions AND the dev-only test-learner
// fallback) with the FULL profile object -- needed by pages that also need
// approvedSubjects/learnerProfileId, not just the learnerId identity slice.
// Reuses both functions unmodified rather than duplicating their
// session/dev-fallback resolution logic.
export type CurrentLearnerContext =
  | {
      status: "success";
      identity: Extract<LearnerIdentityResult, { status: "success" }>;
      profile: AuthenticatedLearnerProfile;
    }
  | Extract<LearnerIdentityResult, { status: "error" }>;

export async function getCurrentLearnerContext(): Promise<CurrentLearnerContext> {
  const authenticatedProfile = await getAuthenticatedLearnerProfile();
  const identity = await getCurrentLearnerIdentity(authenticatedProfile);

  if (identity.status === "error") return identity;

  const profile =
    authenticatedProfile ??
    (await getLearnerProfileByAuthUserId(identity.learnerId));

  if (!profile) {
    return {
      status: "error",
      message: "Unable to load your learner profile.",
      code: "LEARNER_PROFILE_NOT_FOUND",
    };
  }

  return { status: "success", identity, profile };
}
