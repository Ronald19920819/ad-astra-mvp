// Deterministic LiveKit room/participant-identity derivation for the
// production Live Classroom. Pure and side-effect free (no "server-only",
// no database access) so it stays independently testable and safely
// importable from either server or client code -- deliberately mirrors
// lib/subjects/subjectConfig.ts's own testability.
//
// The exact AD Astra subject UUID (SubjectConfiguration.databaseId) is the
// sole, authoritative input: it already distinguishes English Stage 8 from
// Stage 9, Afrikaans Grade 8 from Grade 9, and every Business Studies/
// History variant, exactly the same way lib/supabase/liveClassMessages.ts's
// live-class:${subjectId} Supabase channel already does for chat/presence.
// No subjectKey or family name is ever consulted.
const SUBJECT_DATABASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIVEKIT_SUBJECT_ROOM_PREFIX = "ad-astra-subject-";
const LIVEKIT_OBS_PARTICIPANT_PREFIX = "ad-astra-obs-";

function assertValidSubjectDatabaseId(subjectDatabaseId: string): string {
  const trimmed = subjectDatabaseId.trim();

  if (!SUBJECT_DATABASE_ID_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid AD Astra subject UUID for LiveKit derivation: "${subjectDatabaseId}".`,
    );
  }

  return trimmed.toLowerCase();
}

// Conceptually: ad-astra-subject-<exact-subject-uuid>
export function getLiveKitRoomNameForSubject(subjectDatabaseId: string): string {
  return `${LIVEKIT_SUBJECT_ROOM_PREFIX}${assertValidSubjectDatabaseId(subjectDatabaseId)}`;
}

// Conceptually: ad-astra-obs-<exact-subject-uuid>. The OBS ingress for a
// given subject always publishes under this identity, so the future
// production player can render specifically that participant rather than
// trusting "first remote participant" (which would not generalize once
// multiple teachers are live in different subjects at once).
export function getLiveKitIngressParticipantIdentity(
  subjectDatabaseId: string,
): string {
  return `${LIVEKIT_OBS_PARTICIPANT_PREFIX}${assertValidSubjectDatabaseId(subjectDatabaseId)}`;
}
