import { RoomServiceClient } from "livekit-server-sdk";
import {
  LIVEKIT_RAISED_HAND_ATTRIBUTE,
  isLiveKitLearnerParticipant,
} from "@/lib/liveClass/livekitAttendance";
import { getLiveKitServerConfig } from "@/lib/livekit/serverConfig";
import { getLiveKitRoomNameForSubject } from "@/lib/livekit/subjectRoom";
import { isLiveKitLearnerViewerIdentity } from "@/lib/livekit/viewerIdentity";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";

// A LiveKit participant can only update its OWN attributes client-side
// (LocalParticipant.setAttributes) -- there is no supported client
// mechanism for one participant to mutate another's. Clearing a learner's
// raised hand therefore requires this small authenticated server endpoint,
// using LiveKit's server-side RoomServiceClient.updateParticipant.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (
      !isRecord(body) ||
      typeof body.subjectId !== "string" ||
      !body.subjectId.trim() ||
      typeof body.learnerIdentity !== "string" ||
      !body.learnerIdentity.trim()
    ) {
      return Response.json(
        { error: "A valid subjectId and learnerIdentity are required." },
        { status: 400 },
      );
    }

    const subjectId = body.subjectId.trim();
    const learnerIdentity = body.learnerIdentity.trim();

    const subject = getSubjectConfigurationByDatabaseId(subjectId);
    if (!subject) {
      return Response.json({ error: "Unknown subject." }, { status: 400 });
    }

    // Reject anything not shaped exactly like a real learner viewer
    // identity BEFORE ever calling a LiveKit server API with it -- the OBS
    // ingress participant and the teacher's own identity both fail this
    // check by construction, so neither can ever be targeted.
    if (!isLiveKitLearnerViewerIdentity(learnerIdentity)) {
      return Response.json({ error: "Invalid learner identity." }, { status: 400 });
    }

    // Exact-subject teacher authorization, reused unmodified from Stage 1.
    const teacherAuthorization = await authorizeTeacher(subjectId);
    if (!teacherAuthorization.success) {
      return teacherAuthorizationResponse(teacherAuthorization);
    }

    const config = getLiveKitServerConfig();
    const roomServiceClient = new RoomServiceClient(
      config.apiUrl,
      config.apiKey,
      config.apiSecret,
    );
    const roomName = getLiveKitRoomNameForSubject(subjectId);

    // getParticipant is scoped to this exact room: if the identity isn't
    // actually connected to THIS subject's room right now, this throws --
    // so a teacher authorized for one subject can never clear a hand in a
    // different subject's room, even with a well-formed learner identity
    // string for that other subject.
    let participant;
    try {
      participant = await roomServiceClient.getParticipant(roomName, learnerIdentity);
    } catch {
      return Response.json(
        { error: "That learner is not currently in this Live Classroom." },
        { status: 404 },
      );
    }

    if (!isLiveKitLearnerParticipant(participant)) {
      return Response.json({ error: "Invalid learner identity." }, { status: 400 });
    }

    await roomServiceClient.updateParticipant(roomName, learnerIdentity, {
      attributes: { [LIVEKIT_RAISED_HAND_ATTRIBUTE]: "false" },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Unable to clear a learner's raised hand:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: "Unable to clear the learner's raised hand right now." },
      { status: 500 },
    );
  }
}
