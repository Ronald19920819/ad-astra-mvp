import { deletePublishedBusinessStudiesLesson } from "@/lib/supabase/publishedContentDeleter";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await context.params;

  if (!lessonId || !uuidPattern.test(lessonId)) {
    return Response.json(
      { error: "A valid lesson ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const result = await deletePublishedBusinessStudiesLesson(lessonId);

    if (!result.success) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Published Business Studies lesson deletion failed:", {
      lessonId,
      error,
    });
    return Response.json(
      {
        error: "The lesson could not be deleted. Please try again.",
        code: "DELETE_FAILED",
      },
      { status: 500 },
    );
  }
}
