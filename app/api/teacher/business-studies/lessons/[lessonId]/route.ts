import {
  deleteDraftSubjectLesson,
  deletePublishedSubjectLesson,
} from "@/lib/supabase/publishedContentDeleter";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
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
    const searchParams = new URL(request.url).searchParams;
    const isDraftDelete = searchParams.get("scope") === "draft";
    const subjectId = searchParams.get("subjectId");
    if (
      !subjectId ||
      !uuidPattern.test(subjectId) ||
      !getSubjectConfigurationByDatabaseId(subjectId)
    ) {
      return Response.json(
        { error: "A supported subject is required.", code: "INVALID_SUBJECT" },
        { status: 400 },
      );
    }
    const result = isDraftDelete
      ? await deleteDraftSubjectLesson(subjectId, lessonId)
      : await deletePublishedSubjectLesson(subjectId, lessonId);

    if (!result.success) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Published subject lesson deletion failed:", {
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
