import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { resolveLearnerAuthUserId } from "@/lib/reports/monthlyReportCatalog";
import {
  findMonthlyReportDraft,
  findFinalisedMonthlyReportForPeriod,
  saveMonthlyReportDraft,
  MonthlyReportPeriodAlreadyFinalisedError,
} from "@/lib/reports/monthlyReportRepository";
import { normalizeReportMonth } from "@/lib/reports/monthlyReportMonth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && uuidPattern.test(id));
}

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2: reopening an existing draft
// for the same learner+subject+reporting month (GET), and saving the
// current selection as a draft (POST). Never touches a finalised report --
// findMonthlyReportDraft/saveMonthlyReportDraft only ever look at rows
// still in "draft" status.
//
// AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX. GET also reports
// whether this exact period already has an official FINALISED report
// (finalisedReportId), so the Create Report UI can detect that as early
// as possible -- before ever fetching the catalog or generating a
// preview -- and offer "Open Finalised Report" instead of letting the
// teacher get deep into a selection that can only ever 409 at Finalise
// time. Only the id is returned, never the full report.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const learnerProfileId = url.searchParams.get("learnerProfileId");
  const reportMonth = url.searchParams.get("reportMonth");

  if (
    !subjectId ||
    !uuidPattern.test(subjectId) ||
    !learnerProfileId ||
    !uuidPattern.test(learnerProfileId) ||
    !reportMonth
  ) {
    return NextResponse.json(
      { error: "subjectId, learnerProfileId, and reportMonth are required.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let normalizedReportMonth: string;
  try {
    normalizedReportMonth = normalizeReportMonth(reportMonth);
  } catch {
    return NextResponse.json(
      { error: "Invalid reporting month.", code: "INVALID_REPORT_MONTH" },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const learnerAuthUserId = await resolveLearnerAuthUserId(learnerProfileId);
    if (!learnerAuthUserId) {
      return NextResponse.json({ draft: null, finalisedReportId: null });
    }

    const finalisedReport = await findFinalisedMonthlyReportForPeriod({
      learnerId: learnerAuthUserId,
      subjectId,
      reportMonth: normalizedReportMonth,
    });
    if (finalisedReport) {
      return NextResponse.json({ draft: null, finalisedReportId: finalisedReport.id });
    }

    const draft = await findMonthlyReportDraft({
      learnerId: learnerAuthUserId,
      subjectId,
      reportMonth: normalizedReportMonth,
    });

    return NextResponse.json({ draft, finalisedReportId: null });
  } catch (error) {
    console.error("Unable to load an existing report draft:", error);
    return NextResponse.json(
      { error: "Unable to load an existing draft.", code: "DRAFT_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON request body.", code: "MALFORMED_JSON" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid draft-save request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const { subjectId, learnerProfileId, reportMonth, selectedLessonIds, selectedActivityIds } = payload;

  if (
    typeof subjectId !== "string" ||
    !uuidPattern.test(subjectId) ||
    typeof learnerProfileId !== "string" ||
    !uuidPattern.test(learnerProfileId) ||
    typeof reportMonth !== "string" ||
    !isUuidArray(selectedLessonIds) ||
    !isUuidArray(selectedActivityIds)
  ) {
    return NextResponse.json(
      { error: "Invalid draft-save request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let normalizedReportMonth: string;
  try {
    normalizedReportMonth = normalizeReportMonth(reportMonth);
  } catch {
    return NextResponse.json(
      { error: "Invalid reporting month.", code: "INVALID_REPORT_MONTH" },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const learnerAuthUserId = await resolveLearnerAuthUserId(learnerProfileId);
    if (!learnerAuthUserId) {
      return NextResponse.json(
        { error: "Learner not found for this subject.", code: "LEARNER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const draft = await saveMonthlyReportDraft({
      learnerId: learnerAuthUserId,
      subjectId,
      teacherId: authorization.teacher.profileId,
      reportMonth: normalizedReportMonth,
      selectedLessonIds,
      selectedActivityIds,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof MonthlyReportPeriodAlreadyFinalisedError) {
      return NextResponse.json(
        { error: error.message, code: "ALREADY_FINALISED_PERIOD" },
        { status: 409 },
      );
    }
    console.error("Unable to save the report draft:", error);
    return NextResponse.json(
      { error: "Unable to save the draft.", code: "DRAFT_SAVE_FAILED" },
      { status: 500 },
    );
  }
}
