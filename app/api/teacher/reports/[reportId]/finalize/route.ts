import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  getMonthlyReportById,
  finalizeMonthlyReport,
} from "@/lib/reports/monthlyReportRepository";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE. Turns a
// teacher-reviewed draft into an immutable historical record. Takes no
// request body at all -- the client sends nothing but the report ID;
// every fact this checks (subject, status, snapshot freshness, commentary
// staleness/validity) is resolved authoritatively server-side inside
// finalizeMonthlyReport, never trusted from whatever the browser currently
// displays.
export async function POST(
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

    const result = await finalizeMonthlyReport(reportId);
    if (!result.success) {
      const status =
        result.code === "ALREADY_FINALISED" ||
        result.code === "CONCURRENT_FINALISATION" ||
        result.code === "ALREADY_FINALISED_PERIOD"
          ? 409
          : result.code === "INVALID_SNAPSHOT"
            ? 500
            : 422; // NO_KINGDOM_COMMENTS, STALE_COMMENTARY, INVALID_COMMENTS
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status },
      );
    }

    return NextResponse.json({ report: result.report });
  } catch (error) {
    console.error("Unable to finalise monthly report:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to finalise this report. Please try again.", code: "FINALISE_FAILED" },
      { status: 500 },
    );
  }
}
