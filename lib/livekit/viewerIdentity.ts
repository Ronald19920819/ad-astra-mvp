// Deterministic LiveKit viewer-participant identity construction/validation.
// Pure, no "server-only", so it stays testable and shareable between the
// token-minting route (which BUILDS an identity) and the teacher clear-hand
// route (which must VALIDATE an identity before ever calling a LiveKit
// server API with it).
export type LiveKitViewerRole = "learner" | "teacher";

const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidProfileId(profileId: string): string {
  const trimmed = profileId.trim();

  if (!PROFILE_ID_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid AD Astra profileId for a LiveKit viewer identity: "${profileId}".`,
    );
  }

  return trimmed.toLowerCase();
}

export function buildLiveKitViewerIdentity(
  role: LiveKitViewerRole,
  profileId: string,
): string {
  return `viewer-${role}-${assertValidProfileId(profileId)}`;
}

const LEARNER_VIEWER_IDENTITY_PATTERN =
  /^viewer-learner-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Used by the teacher clear-hand endpoint to reject anything that isn't
// shaped exactly like a real learner viewer identity BEFORE ever calling a
// LiveKit server API with it. The OBS ingress identity
// (ad-astra-obs-<subjectUuid>, from lib/livekit/subjectRoom.ts) and the
// teacher's own identity (viewer-teacher-<profileId>) both fail this check
// by construction, so neither can ever be targeted.
export function isLiveKitLearnerViewerIdentity(identity: string): boolean {
  return LEARNER_VIEWER_IDENTITY_PATTERN.test(identity);
}
