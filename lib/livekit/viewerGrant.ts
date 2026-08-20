import type { VideoGrant } from "livekit-server-sdk";
import { getLiveKitRoomNameForSubject } from "@/lib/livekit/subjectRoom";

// Both learner and teacher browsers are subscribe-only for the production
// Live Classroom: OBS publishes via the per-subject Ingress, so neither
// browser needs (or is granted) camera/microphone/data publish rights.
// This is the ONLY function that produces a `room` value for a viewer
// token -- it takes an already-authorized subjectId and nothing else, so
// there is no code path through which a client-supplied room name could
// ever reach a token grant.
export function buildLiveKitViewerGrant(subjectDatabaseId: string): VideoGrant {
  return {
    room: getLiveKitRoomNameForSubject(subjectDatabaseId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    // LiveKit roster is authoritative for attendance/raised-hand for this
    // provider (lib/liveClass/livekitAttendance.ts) -- a "hidden" grant
    // would make viewers invisible to useRemoteParticipants() for every
    // other participant, including the teacher, which is exactly what was
    // producing an empty Attendance card. Do not reintroduce it.
    //
    // Required for LocalParticipant.setAttributes (raise/lower hand, and
    // the initial-attributes push every viewer's client performs on
    // connect) -- without it LiveKit rejects the update with "not allowed
    // to update own metadata/attributes". Granted to both roles because
    // LiveKitClassroomPlayer.tsx calls setAttributes for every connected
    // viewer, not only learners.
    canUpdateOwnMetadata: true,
  };
}
