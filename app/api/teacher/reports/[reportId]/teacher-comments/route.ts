import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  getMonthlyReportById,
  saveMonthlyReportTeacherEditedComments,
} from "@/lib/reports/monthlyReportRepository";
import {
  MONTHLY_REPORT_TEACHER_EDITED_COMMENTS_SCHEMA_VERSION,
  validateTeacherEditedMonthlyReportComments,
} from "@/lib/reports/kingdomMonthlyReport";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 4A: TEACHER COMMENT REVIEW & EDITING.
// Saves a teacher's reviewed/edited commentary into teacher_edited_comments.
// The client sends only the edited comments -- authorisation and the
// draft/finalised check are always resolved from the stored report row
// itself, never trusted from the request. This never recomputes the
// report snapshot (editing wording doesn't depend on live data) and never
// touches Kingdom's own generated commentary column -- see
// monthlyReportRepository.ts's own header comment for that separation.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON request body.", code: "MALFORMED_JSON" },
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

    if (existing.status === "finalised") {
      return NextResponse.json(
        {
          error:
            "This report is already finalised. Comments can only be edited on a draft.",
          code: "ALREADY_FINALISED",
        },
        { status: 409 },
      );
    }

    let comments;
    try {
      comments = validateTeacherEditedMonthlyReportComments(body);
    } catch (validationError) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : "Invalid comments.",
          code: "INVALID_COMMENTS",
        },
        { status: 422 },
      );
    }

    const updated = await saveMonthlyReportTeacherEditedComments(reportId, {
      schemaVersion: MONTHLY_REPORT_TEACHER_EDITED_COMMENTS_SCHEMA_VERSION,
      editedAt: new Date().toISOString(),
      comments,
    });

    return NextResponse.json({ draft: updated });
  } catch (error) {
    console.error("Unable to save teacher-edited monthly report comments:", {
      reportId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to save your changes. Please try again.", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}
