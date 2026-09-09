import { AccessToken } from "livekit-server-sdk";
import { getLiveKitServerConfig } from "@/lib/livekit/serverConfig";
import { LIVEKIT_TEST_ROOM_NAME } from "@/lib/livekit/testRoom";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

// Isolated LiveKit proof-of-concept token endpoint. Deliberately separate
// from any production Live Classroom authorization path: it only ever
// issues a subscribe-only token for the single test room
// (LIVEKIT_TEST_ROOM_NAME), never a subject room, and never a token that
// can publish.
async function resolveAuthenticatedViewer() {
  const teacherProfile = await getAuthenticatedTeacherProfile();
  if (teacherProfile) {
    return {
      role: "teacher" as const,
      profileId: teacherProfile.profileId,
      displayName: teacherProfile.displayName,
    };
  }

  const learnerProfile = await getAuthenticatedLearnerProfile();
  if (learnerProfile) {
    return {
      role: "learner" as const,
      profileId: learnerProfile.profileId,
      displayName: learnerProfile.displayName,
    };
  }

  return null;
}

export async function POST() {
  try {
    const viewer = await resolveAuthenticatedViewer();
    if (!viewer) {
      return Response.json(
        { error: "Sign in is required to join the LiveKit test room." },
        { status: 401 },
      );
    }

    const config = getLiveKitServerConfig();

    const accessToken = new AccessToken(config.apiKey, config.apiSecret, {
      identity: `viewer-${viewer.role}-${viewer.profileId}`,
      name: viewer.displayName,
      ttl: "30m",
    });

    accessToken.addGrant({
      room: LIVEKIT_TEST_ROOM_NAME,
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
    });

    const token = await accessToken.toJwt();

    return Response.json({ token, url: config.wsUrl });
  } catch (error) {
    console.error("Unable to issue LiveKit test token:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: "Unable to join the LiveKit test room right now." },
      { status: 500 },
    );
  }
}
