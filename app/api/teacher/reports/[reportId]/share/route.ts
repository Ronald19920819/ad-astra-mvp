import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getMonthlyReportById } from "@/lib/reports/monthlyReportRepository";
import {
  createShareForReport,
  getActiveShareForReport,
  revokeActiveShareForReport,
} from "@/lib/reports/monthlyReportShareRepository";
import { getAbsoluteAppUrl } from "@/lib/email/appUrl";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildPublicReportUrl(token: string): string {
  return getAbsoluteAppUrl(`/report/${token}`);
}

// Read-only status check -- never creates or revokes anything. Used by
// the teacher-facing delivery UI on load to decide whether to show "no
// link yet" (never sent) vs. an active link's Copy/Disable controls vs.
// a disabled link, without that mere page load ever creating a link the
// teacher hasn't asked for.
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

    if (existing.status !== "finalised") {
      return NextResponse.json({ active: false, url: null });
    }

    const existingShare = await getActiveShareForReport(reportId);
    return NextResponse.json({
      active: Boolean(existingShare),
      url: existingShare ? buildPublicReportUrl(existingShare.token) : null,
    });
  } catch (error) {
    console.error("Unable to read monthly report share status:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to load the report link status.", code: "SHARE_STATUS_FAILED" },
      { status: 500 },
    );
  }
}

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK.
//
// POST body: { action?: "ensure" | "regenerate" }. "ensure" (the
// default) never disturbs an already-active share -- it returns the
// existing one's URL untouched if one exists, or creates a fresh one if
// not, so requesting the link never invalidates one a teacher may
// already have sent out. "regenerate" deliberately revokes whatever is
// active first, then creates a fresh one -- an explicit, deliberate way
// to invalidate a link (e.g. it was sent to the wrong person) and issue a
// genuinely new one, matching the "new token, never a restored old one"
// behaviour the product design requires for a compromised link.
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

  let action: "ensure" | "regenerate" = "ensure";
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.action === "regenerate") {
      action = "regenerate";
    }
  } catch {
    // No body (or malformed JSON) simply means "ensure" -- this endpoint
    // never requires a body for its default behaviour.
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

    if (existing.status !== "finalised") {
      return NextResponse.json(
        {
          error: "A public report link can only be created for a finalised report.",
          code: "NOT_FINALISED",
        },
        { status: 422 },
      );
    }

    if (action === "regenerate") {
      await revokeActiveShareForReport(reportId);
      const share = await createShareForReport({
        reportId,
        createdBy: authorization.teacher.profileId,
      });
      return NextResponse.json({ active: true, url: buildPublicReportUrl(share.token) });
    }

    const existingShare = await getActiveShareForReport(reportId);
    if (existingShare) {
      return NextResponse.json({ active: true, url: buildPublicReportUrl(existingShare.token) });
    }

    const share = await createShareForReport({
      reportId,
      createdBy: authorization.teacher.profileId,
    });
    return NextResponse.json({ active: true, url: buildPublicReportUrl(share.token) });
  } catch (error) {
    console.error("Unable to create/ensure a monthly report share:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to set up the report link. Please try again.", code: "SHARE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    await revokeActiveShareForReport(reportId);
    return NextResponse.json({ active: false });
  } catch (error) {
    console.error("Unable to revoke a monthly report share:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to disable the report link. Please try again.", code: "REVOKE_FAILED" },
      { status: 500 },
    );
  }
}
