import { deletePublishedBusinessStudiesActivity } from "@/lib/supabase/publishedContentDeleter";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ activityId: string }> },
) {
  const { activityId } = await context.params;

  if (!activityId || !uuidPattern.test(activityId)) {
    return Response.json(
      { error: "A valid activity ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const result = await deletePublishedBusinessStudiesActivity(activityId);

    if (!result.success) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Published Business Studies activity deletion failed:", {
      activityId,
      error,
    });
    return Response.json(
      {
        error: "The activity could not be deleted. Please try again.",
        code: "DELETE_FAILED",
      },
      { status: 500 },
    );
  }
}
