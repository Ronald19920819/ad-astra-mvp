import { AccessToken } from "livekit-server-sdk";
import { buildLiveKitViewerAttributes } from "@/lib/liveClass/livekitAttendance";
import { getLiveKitServerConfig } from "@/lib/livekit/serverConfig";
import { buildLiveKitViewerGrant } from "@/lib/livekit/viewerGrant";
import {
  buildLiveKitViewerIdentity,
  type LiveKitViewerRole,
} from "@/lib/livekit/viewerIdentity";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

// Production Stage 1 foundation for the LiveKit Live Classroom. This route
// is not yet wired into any page (no provider switch exists yet) -- it
// exists so the token/authorization architecture can be built and tested
// ahead of LiveKitClassroomPlayer (Stage 2).
//
// A production join token, unlike the /api/livekit/test-token POC, needs to
// remain valid for the full length of a lesson: LiveKit's client SDK
// re-authenticates with the SAME token on every reconnect (not just the
// initial handshake), so a token that expires mid-lesson would strand a
// learner on the next network blip. LiveKit's own server SDK defaults
// AccessToken TTL to 6h for exactly this reason. AD Astra lessons are much
// shorter than that, so 2 hours is used here: comfortably longer than any
// realistic single lesson (including a double period) while still being
// meaningfully bounded, and not so short that ordinary reconnect behavior
// risks tripping over expiry. No custom token-refresh mechanism is
// implemented -- it is not needed at this TTL.
const PRODUCTION_TOKEN_TTL = "2h";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function issueViewerToken(options: {
  role: LiveKitViewerRole;
  profileId: string;
  displayName: string;
  subjectDatabaseId: string;
}) {
  const config = getLiveKitServerConfig();

  const accessToken = new AccessToken(config.apiKey, config.apiSecret, {
    identity: buildLiveKitViewerIdentity(options.role, options.profileId),
    name: options.displayName,
    ttl: PRODUCTION_TOKEN_TTL,
    // Encodes role (and, for learners, a well-defined initial raisedHand
    // value) directly on the participant so the Attendance card and
    // teacher clear-hand endpoint can rely on it without inferring role
    // from the identity string alone.
    attributes: buildLiveKitViewerAttributes(options.role),
  });

  accessToken.addGrant(buildLiveKitViewerGrant(options.subjectDatabaseId));

  const token = await accessToken.toJwt();

  // Only what the browser needs to connect: never the API key/secret, the
  // https:// API URL, an ingress ID, or a stream key.
  return Response.json({ token, url: config.wsUrl });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!isRecord(body) || typeof body.subjectId !== "string" || !body.subjectId.trim()) {
      return Response.json({ error: "A valid subjectId is required." }, { status: 400 });
    }

    const subjectId = body.subjectId.trim();

    // The client identifies WHICH subject's classroom it wants to join --
    // it never supplies a room name, and the room name below is always
    // derived from this server-verified subjectId, never from the request.
    const subject = getSubjectConfigurationByDatabaseId(subjectId);
    if (!subject) {
      return Response.json({ error: "Unknown subject." }, { status: 400 });
    }

    // Role is never trusted from the request body. It is resolved entirely
    // from authenticated AD Astra profile/authorization state, teacher
    // first: authorizeTeacher(subjectId) checks BOTH that the caller has an
    // active teacher profile AND an active assignment to this exact
    // subject, so a teacher assigned to a different subject cannot obtain a
    // token for this one merely by requesting it. Its own status
    // distinguishes "no session at all" (401) from "signed in, but not
    // authorized" (403), reused below instead of a second auth lookup.
    const teacherAuthorization = await authorizeTeacher(subjectId);
    if (teacherAuthorization.success) {
      const teacherProfile = await getAuthenticatedTeacherProfile();
      if (teacherProfile) {
        return issueViewerToken({
          role: "teacher",
          profileId: teacherProfile.profileId,
          displayName: teacherProfile.displayName,
          subjectDatabaseId: subjectId,
        });
      }
    }

    const learnerProfile = await getAuthenticatedLearnerProfile();
    if (learnerProfile) {
      const access = verifyLearnerSubjectAccessForProfile(learnerProfile, subjectId);
      if (access.allowed) {
        return issueViewerToken({
          role: "learner",
          profileId: learnerProfile.profileId,
          displayName: learnerProfile.displayName,
          subjectDatabaseId: subjectId,
        });
      }

      return Response.json(
        { error: "You do not have access to this subject's Live Classroom." },
        { status: 403 },
      );
    }

    if (!teacherAuthorization.success && teacherAuthorization.status === 401) {
      return Response.json(
        { error: "Sign-in is required to join this Live Classroom." },
        { status: 401 },
      );
    }

    return Response.json(
      { error: "You do not have access to this subject's Live Classroom." },
      { status: 403 },
    );
  } catch (error) {
    console.error("Unable to issue production LiveKit token:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: "Unable to join the Live Classroom right now." },
      { status: 500 },
    );
  }
}
