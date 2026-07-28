import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getTeacherSubjectAnnouncement } from "@/lib/supabase/subjectCommunications";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(error: string) {
  return Response.json({ error, code: "INVALID_REQUEST" }, { status: 400 });
}

async function parseBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");
  if (!subjectId || !uuidPattern.test(subjectId)) {
    return invalid("A valid subject is required.");
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const announcement = await getTeacherSubjectAnnouncement(
      null,
      subjectId,
    );
    return Response.json({ announcement });
  } catch (error) {
    console.error("Unable to load subject announcement:", error);
    return Response.json(
      {
        error: "Unable to load the subject announcement.",
        code: "LOAD_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body || typeof body !== "object") {
    return invalid("Malformed JSON request body.");
  }

  const subjectId = "subjectId" in body ? body.subjectId : null;
  const message = "message" in body ? body.message : null;
  if (
    typeof subjectId !== "string" ||
    !uuidPattern.test(subjectId) ||
    typeof message !== "string" ||
    !message.trim() ||
    message.trim().length > 1200
  ) {
    return invalid("A valid subject announcement is required.");
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const { admin, teacherProfileId } = authorization.teacher;
    const { error } = await admin
      .from("subject_announcements")
      .upsert(
        {
          subject_id: subjectId,
          teacher_profile_id: teacherProfileId,
          message: message.trim(),
        },
        { onConflict: "subject_id" },
      )
      .select(
        "id, subject_id, teacher_profile_id, message, created_at, updated_at",
      )
      .single();

    if (error) throw error;
    const announcement = await getTeacherSubjectAnnouncement(
      null,
      subjectId,
    );
    return Response.json({ announcement });
  } catch (error) {
    console.error("Unable to save subject announcement:", error);
    return Response.json(
      {
        error: "Unable to save the subject announcement.",
        code: "SAVE_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = await parseBody(request);
  if (!body || typeof body !== "object") {
    return invalid("Malformed JSON request body.");
  }

  const subjectId = "subjectId" in body ? body.subjectId : null;
  if (typeof subjectId !== "string" || !uuidPattern.test(subjectId)) {
    return invalid("A valid subject is required.");
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const { error } = await authorization.teacher.admin
      .from("subject_announcements")
      .delete()
      .eq("subject_id", subjectId);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    console.error("Unable to delete subject announcement:", error);
    return Response.json(
      {
        error: "Unable to delete the subject announcement.",
        code: "DELETE_FAILED",
      },
      { status: 500 },
    );
  }
}
