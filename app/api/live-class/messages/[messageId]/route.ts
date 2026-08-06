import {
  isUuid,
  LiveClassApiError,
  logLiveClassApiError,
  softDeleteLiveClassMessage,
  validateMessageId,
} from "@/lib/supabase/liveClassMessages";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const params = await context.params;
  const messageIdValue = params.messageId;

  try {
    const messageId = validateMessageId(messageIdValue);
    const result = await softDeleteLiveClassMessage(messageId);
    return Response.json(result);
  } catch (error) {
    const messageId =
      typeof messageIdValue === "string" && isUuid(messageIdValue)
        ? messageIdValue
        : null;

    if (error instanceof LiveClassApiError) {
      if (error.status >= 500) {
        logLiveClassApiError(
          {
            route: "/api/live-class/messages/[messageId]",
            method: "DELETE",
            messageId,
          },
          error,
        );
      }

      return Response.json({ error: error.message }, { status: error.status });
    }

    logLiveClassApiError(
      {
        route: "/api/live-class/messages/[messageId]",
        method: "DELETE",
        messageId,
      },
      error,
    );

    return Response.json(
      { error: "Unable to delete the Live Classroom message." },
      { status: 500 },
    );
  }
}
