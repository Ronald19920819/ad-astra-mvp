import {
  createLiveClassMessage,
  ensureOnlyAllowedKeys,
  getLiveClassMessages,
  isUuid,
  LiveClassApiError,
  logLiveClassApiError,
  parseChatMessage,
  parseJsonBody,
  validateSubjectId,
} from "@/lib/supabase/liveClassMessages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectIdValue = searchParams.get("subjectId");

  try {
    const subjectId = validateSubjectId(subjectIdValue);
    const messages = await getLiveClassMessages(subjectId);
    return Response.json({ messages });
  } catch (error) {
    const subjectId =
      typeof subjectIdValue === "string" && isUuid(subjectIdValue)
        ? subjectIdValue
        : null;

    if (error instanceof LiveClassApiError) {
      if (error.status >= 500) {
        logLiveClassApiError(
          {
            route: "/api/live-class/messages",
            method: "GET",
            subjectId,
          },
          error,
        );
      }

      return Response.json({ error: error.message }, { status: error.status });
    }

    logLiveClassApiError(
      {
        route: "/api/live-class/messages",
        method: "GET",
        subjectId,
      },
      error,
    );

    return Response.json(
      { error: "Unable to load Live Classroom messages." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let subjectId: string | null = null;

  try {
    const body = await parseJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new LiveClassApiError(
        400,
        "INVALID_REQUEST",
        "A valid message request is required.",
      );
    }

    ensureOnlyAllowedKeys(body, ["subjectId", "message"]);

    subjectId = validateSubjectId(body.subjectId);
    const message = parseChatMessage(body.message);
    const savedMessage = await createLiveClassMessage(subjectId, message);

    return Response.json({ message: savedMessage });
  } catch (error) {
    if (error instanceof LiveClassApiError) {
      if (error.status >= 500) {
        logLiveClassApiError(
          {
            route: "/api/live-class/messages",
            method: "POST",
            subjectId,
          },
          error,
        );
      }

      return Response.json({ error: error.message }, { status: error.status });
    }

    logLiveClassApiError(
      {
        route: "/api/live-class/messages",
        method: "POST",
        subjectId,
      },
      error,
    );

    return Response.json(
      { error: "Unable to send the Live Classroom message." },
      { status: 500 },
    );
  }
}
