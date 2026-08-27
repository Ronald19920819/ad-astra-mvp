import {
  authorizeAdministrator,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(error: string) {
  return Response.json({ error, code: "INVALID_REQUEST" }, { status: 400 });
}

// Stage A entitlement mutation only -- this route touches
// learner_profiles.accessibility_enabled and nothing else. It must never be
// extended to write XP, AC, enrolments, submissions, or lesson completion.
//
// Identity and authorization are entirely server-derived:
// authorizeAdministrator() re-checks the authenticated session against
// teacher_profiles.is_administrator itself (see
// lib/supabase/teacherAuth.ts). The request body supplies only the new
// `enabled` value -- never a caller-asserted learner ID for identity
// purposes (the learnerId route param identifies WHICH learner_profiles
// row to update, not WHO is making the change) and never a
// caller-asserted role/administrator flag.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  try {
    const { learnerId } = await params;

    if (!uuidPattern.test(learnerId)) {
      return invalid("A valid learner ID is required.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalid("Malformed JSON request body.");
    }

    const enabled =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).enabled
        : undefined;

    if (typeof enabled !== "boolean") {
      return invalid("A boolean 'enabled' value is required.");
    }

    const authorization = await authorizeAdministrator();
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }

    const { admin } = authorization.teacher;

    const { data: learnerProfile, error: learnerProfileError } = await admin
      .from("learner_profiles")
      .select("id")
      .eq("id", learnerId)
      .maybeSingle();

    if (learnerProfileError) throw learnerProfileError;
    if (!learnerProfile) {
      return Response.json(
        { error: "Learner not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data, error } = await admin
      .from("learner_profiles")
      .update({ accessibility_enabled: enabled })
      .eq("id", learnerId)
      .select("id, accessibility_enabled")
      .single();

    if (error) throw error;

    return Response.json({
      success: true,
      learnerId: data.id,
      accessibilityEnabled: data.accessibility_enabled === true,
    });
  } catch (error) {
    console.error("Accessibility entitlement update failed:", error);
    return Response.json(
      {
        error: "The accessibility setting could not be saved.",
        code: "SAVE_FAILED",
      },
      { status: 500 },
    );
  }
}
