import { reviewLearnerApproval } from "@/lib/supabase/learnerApprovals";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await context.params;
    if (!uuidPattern.test(requestId)) {
      return Response.json(
        { error: "Invalid learner approval request." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid learner approval action." },
        { status: 400 },
      );
    }
    const action =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).action
        : null;
    if (action !== "approve" && action !== "decline") {
      return Response.json(
        { error: "Choose approve or decline." },
        { status: 400 },
      );
    }

    const result = await reviewLearnerApproval(requestId, action);
    return Response.json({ request: result });
  } catch (error) {
    console.error("Unable to review learner approval request:", error);
    const status =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : 500;
    return Response.json(
      {
        error:
          status === 500
            ? "Unable to review this learner approval request."
            : error instanceof Error
              ? error.message
              : "Unable to review this learner approval request.",
      },
      { status },
    );
  }
}
