import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  getMonthlyReportById,
  recomputeMonthlyReportDraftSnapshot,
  saveMonthlyReportKingdomComments,
} from "@/lib/reports/monthlyReportRepository";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import { generateKingdomMonthlyReportComments } from "@/lib/reports/kingdomMonthlyReportGeneration";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 3: (re)generates Kingdom commentary for
// an EXISTING SAVED DRAFT. The client never sends report statistics here --
// only the report ID. Every fact Kingdom sees is recomputed from live data
// server-side immediately before generation (recomputeMonthlyReportDraftSnapshot),
// so commentary can never describe a stale selection or figures the client
// made up. Draft-only: a finalised report's commentary is frozen, matching
// every other mutation in monthlyReportRepository.ts.
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

    if (existing.status === "finalised") {
      return NextResponse.json(
        {
          error:
            "This report is already finalised. Commentary can only be generated for a draft.",
          code: "ALREADY_FINALISED",
        },
        { status: 409 },
      );
    }

    const subject = getSubjectConfigurationByDatabaseId(existing.subject_id);
    if (!subject) {
      return NextResponse.json(
        { error: "The report subject is not supported.", code: "INVALID_SUBJECT" },
        { status: 422 },
      );
    }

    const recomputed = await recomputeMonthlyReportDraftSnapshot(reportId);
    if (!recomputed.report_snapshot) {
      return NextResponse.json(
        { error: "The report has no content to comment on yet.", code: "EMPTY_REPORT" },
        { status: 422 },
      );
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey: subject.key,
      role: "Analyst",
      taskType: "Generate monthly progress report commentary",
    });

    const storedComments = await generateKingdomMonthlyReportComments({
      payload: recomputed.report_snapshot,
      subjectContext,
    });

    const updated = await saveMonthlyReportKingdomComments(reportId, storedComments);
    return NextResponse.json({ draft: updated });
  } catch (error) {
    console.error("Unable to generate Kingdom monthly report commentary:", {
      reportId,
      error,
    });
    return NextResponse.json(
      {
        error: "Unable to generate report commentary. Please try again.",
        code: "COMMENTS_GENERATION_FAILED",
      },
      { status: 502 },
    );
  }
}
