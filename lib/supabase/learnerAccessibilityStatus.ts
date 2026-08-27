import "server-only";

import { createSupabaseRequestClient } from "@/lib/supabase/server";
import { getLearnerAccessibilityEntitlement } from "@/lib/supabase/learnerAccessibility";

// AD ASTRA ACCESSIBILITY STAGE E section 10: for v1, a single global
// entitlement (learner_profiles.accessibility_enabled) grants every
// accommodation -- there is no per-accommodation administrator control
// yet, and none is added by this type. What this type DOES do is give
// every consuming component (ListenToQuestionButton, RecordAnswerButton)
// its OWN named capability flag to gate on, instead of a single shared
// boolean threaded everywhere. When granular accommodations are
// introduced later (e.g. "question read-aloud" approved but "speech-to-
// text" not), only getCurrentLearnerAccessibilityStatus below needs to
// change to compute these independently -- no consuming component's
// props or gating logic would need to change.
export type LearnerAccessibilityCapabilities = {
  questionAudio: boolean;
  recordAnswer: boolean;
};

// A single, tiny SSR convenience wrapper around the Stage A canonical
// entitlement reader (getLearnerAccessibilityEntitlement) -- used ONLY to
// decide whether a page should render accessibility controls at all.
// This is a UI-visibility convenience, never an authorization decision:
// every accessibility route (question-audio, transcribe-answer)
// re-verifies entitlement itself, independently, from the authenticated
// session -- a learner who somehow forced a control to render
// client-side still gets a 403 from the route. No entitlement logic is
// duplicated here; this only resolves the current session and delegates
// straight to the Stage A reader.
export async function getCurrentLearnerAccessibilityStatus(): Promise<{
  accessibilityEnabled: boolean;
  capabilities: LearnerAccessibilityCapabilities;
}> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (!user) {
    return {
      accessibilityEnabled: false,
      capabilities: { questionAudio: false, recordAnswer: false },
    };
  }

  const { accessibilityEnabled } = await getLearnerAccessibilityEntitlement({
    authUserId: user.id,
  });

  return {
    accessibilityEnabled,
    capabilities: { questionAudio: accessibilityEnabled, recordAnswer: accessibilityEnabled },
  };
}
