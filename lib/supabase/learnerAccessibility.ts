import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Stage A: entitlement only. Accessibility is a single, learner-global flag
// on learner_profiles (not per subject, not per enrolment) -- see
// supabase/migrations/202608260001_learner_accessibility_entitlement.sql.
// This is the ONE canonical place that reads it; later stages (lesson
// reading audio, quiz/activity question audio, Record Answer) must call
// this instead of re-querying learner_profiles themselves.
export type LearnerAccessibilityEntitlement = {
  accessibilityEnabled: boolean;
};

export type LearnerAccessibilityIdentifier =
  | { learnerProfileId: string }
  | { authUserId: string };

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

async function resolveLearnerProfileId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: learnerProfile, error: learnerProfileError } = await admin
    .from("learner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  return learnerProfile?.id ?? null;
}

// Resolves to { accessibilityEnabled: false } for any learner who does not
// have the entitlement -- including a genuinely disabled learner, an
// unresolvable identifier, and (defensively, matching this codebase's
// existing isMissingColumnError fallback convention) a database that has
// not yet had the migration applied. Never throws for "not entitled";
// only throws for genuine unexpected database errors.
export async function getLearnerAccessibilityEntitlement(
  identifier: LearnerAccessibilityIdentifier,
): Promise<LearnerAccessibilityEntitlement> {
  const admin = createSupabaseAdminClient();

  const learnerProfileId =
    "learnerProfileId" in identifier
      ? identifier.learnerProfileId
      : await resolveLearnerProfileId(admin, identifier.authUserId);

  if (!learnerProfileId) {
    return { accessibilityEnabled: false };
  }

  const { data, error } = await admin
    .from("learner_profiles")
    .select("accessibility_enabled")
    .eq("id", learnerProfileId)
    .maybeSingle();

  if (isMissingColumnError(error)) {
    return { accessibilityEnabled: false };
  }
  if (error) throw error;

  return {
    accessibilityEnabled:
      (data as { accessibility_enabled?: boolean } | null)
        ?.accessibility_enabled === true,
  };
}
