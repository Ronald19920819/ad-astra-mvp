import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { logSupabaseError } from "@/lib/supabase/errorDetails";
import { getTeacherSubjectEvents } from "@/lib/supabase/subjectCommunications";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(error: string) {
  return Response.json({ error, code: "INVALID_REQUEST" }, { status: 400 });
}

function isDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
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
    const events = await getTeacherSubjectEvents(
      null,
      subjectId,
    );
    return Response.json({ events: events.slice(0, 3) });
  } catch (error) {
    logSupabaseError("Unable to load teacher subject events:", error);
    return Response.json(
      { error: "Unable to load subject events.", code: "LOAD_FAILED" },
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
  if (typeof subjectId !== "string" || !uuidPattern.test(subjectId)) {
    return invalid("A valid subject is required.");
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  const action = "action" in body ? body.action : null;
  const eventId = "eventId" in body ? body.eventId : null;
  const title = "title" in body ? body.title : null;
  const description = "description" in body ? body.description : null;
  const eventDate = "eventDate" in body ? body.eventDate : null;

  if (
    (action !== "create" && action !== "update") ||
    (eventId !== null &&
      eventId !== undefined &&
      (typeof eventId !== "string" || !uuidPattern.test(eventId))) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 200 ||
    (description !== null &&
      description !== undefined &&
      typeof description !== "string") ||
    !isDateString(eventDate)
  ) {
    return invalid("Invalid subject event details.");
  }

  try {
    const { admin, teacherProfileId } = authorization.teacher;

    if (action === "create") {
      const { count, error: countError } = await admin
        .from("subject_events")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", subjectId)
        .gte("event_date", new Date().toISOString().slice(0, 10));

      if (countError) throw countError;
      if ((count ?? 0) >= 3) {
        return Response.json(
          {
            error: "Only three active events can be published for a subject.",
            code: "LIMIT_REACHED",
          },
          { status: 409 },
        );
      }

      const { data, error } = await admin
        .from("subject_events")
        .insert({
          subject_id: subjectId,
          teacher_profile_id: teacherProfileId,
          title: title.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          event_date: eventDate,
        })
        .select(
          "id, subject_id, teacher_profile_id, title, description, event_date, created_at, updated_at",
        )
        .single();

      if (error) throw error;
      return Response.json({
        event: {
          id: data.id,
          subjectId: data.subject_id,
          title: data.title,
          description: data.description,
          eventDate: data.event_date,
        },
      });
    }

    if (!eventId) {
      return invalid("A valid subject event is required.");
    }

    const { data, error } = await admin
      .from("subject_events")
      .update({
        teacher_profile_id: teacherProfileId,
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        event_date: eventDate,
      })
      .eq("id", eventId)
      .eq("subject_id", subjectId)
      .select(
        "id, subject_id, teacher_profile_id, title, description, event_date, created_at, updated_at",
      )
      .single();

    if (error) throw error;
    return Response.json({
      event: {
        id: data.id,
        subjectId: data.subject_id,
        title: data.title,
        description: data.description,
        eventDate: data.event_date,
      },
    });
  } catch (error) {
    logSupabaseError("Unable to save teacher subject event:", error);
    return Response.json(
      { error: "Unable to save the subject event.", code: "SAVE_FAILED" },
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
  const eventId = "eventId" in body ? body.eventId : null;
  if (
    typeof subjectId !== "string" ||
    !uuidPattern.test(subjectId) ||
    typeof eventId !== "string" ||
    !uuidPattern.test(eventId)
  ) {
    return invalid("A valid subject event is required.");
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const { error } = await authorization.teacher.admin
      .from("subject_events")
      .delete()
      .eq("id", eventId)
      .eq("subject_id", subjectId);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    logSupabaseError("Unable to delete teacher subject event:", error);
    return Response.json(
      { error: "Unable to delete the subject event.", code: "DELETE_FAILED" },
      { status: 500 },
    );
  }
}
