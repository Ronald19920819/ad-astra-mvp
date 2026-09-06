import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getMonthlyReportById } from "@/lib/reports/monthlyReportRepository";
import { getLearnerProfileByAuthUserId } from "@/lib/supabase/learnerProfile";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 4C: resolves the Main Recipient
// prefill value for the "Send Progress Report" UI -- the learner's own
// registered email, resolved server-side from the report's learner_id
// (an auth.users id) via the same getLearnerProfileByAuthUserId already
// used for the review-return email flow. The client never supplies or
// otherwise identifies the learner; it only ever receives this value to
// prefill a field the teacher may still edit.
export async function GET(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;
  if (!reportId || !uuidPattern.test(reportId)) {
    return NextResponse.json(
      { error: "A valid report ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const existing = await getMonthlyReportById(reportId);
    if (!existing) {
      return NextResponse.json(
        { error: "Report not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const authorization = await authorizeTeacher(existing.subject_id);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }

    const learnerProfile = await getLearnerProfileByAuthUserId(existing.learner_id);
    return NextResponse.json({ email: learnerProfile?.email ?? null });
  } catch (error) {
    console.error("Unable to resolve the learner's registered email:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to load the default recipient.", code: "RECIPIENT_DEFAULT_FAILED" },
      { status: 500 },
    );
  }
}
