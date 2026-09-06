import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getMonthlyReportById } from "@/lib/reports/monthlyReportRepository";
import {
  createShareForReport,
  getActiveShareForReport,
} from "@/lib/reports/monthlyReportShareRepository";
import { recordMonthlyReportDelivery } from "@/lib/reports/monthlyReportDeliveryRepository";
import { normalizeAndValidateRecipients } from "@/lib/reports/monthlyReportRecipients";
import { getAbsoluteAppUrl } from "@/lib/email/appUrl";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildMonthlyReportDeliveryEmail } from "@/lib/email/templates/monthlyReportDelivery";
import { formatReportMonthLabel } from "@/lib/reports/monthlyReportMonth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 4C: "Send Report". Authenticates and
// authorises the teacher, loads the FINALISED report (rejecting a draft
// outright -- drafts must never be emailed), validates the requested
// recipients, ensures an active public link exists (creating one if this
// is the very first send -- a teacher should never have to separately
// "set up" the link before sending), sends exactly ONE email using
// To/CC, and records the attempt in the append-only delivery history
// regardless of whether the send succeeded or failed. A failed email
// send is recorded and reported back to the teacher, but never touches
// the report row itself -- finalisation is a one-way fact about the
// report's content, not about whether any particular email happened to
// go out.
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid send request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const { mainRecipient, ccRecipients } = body as Record<string, unknown>;
  const validation = normalizeAndValidateRecipients({ mainRecipient, ccRecipients });
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error, code: "INVALID_RECIPIENTS" },
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

    if (existing.status !== "finalised" || !existing.report_snapshot) {
      return NextResponse.json(
        {
          error: "Only a finalised report can be sent.",
          code: "NOT_FINALISED",
        },
        { status: 422 },
      );
    }

    const share =
      (await getActiveShareForReport(reportId)) ??
      (await createShareForReport({
        reportId,
        createdBy: authorization.teacher.profileId,
      }));
    const reportUrl = getAbsoluteAppUrl(`/report/${share.token}`);

    const { subject, html } = buildMonthlyReportDeliveryEmail({
      learnerName: existing.report_snapshot.meta.learnerName,
      subjectName: existing.report_snapshot.meta.subjectName,
      reportMonthLabel: formatReportMonthLabel(existing.report_month),
      reportUrl,
    });

    const { mainRecipient: to, ccRecipients: cc } = validation.recipients;
    const result = await sendEmail({ to, cc, subject, html });

    if (!result.success) {
      await recordMonthlyReportDelivery({
        reportId,
        mainRecipient: to,
        ccRecipients: cc,
        sentBy: authorization.teacher.profileId,
        status: "failed",
        failureMessage: result.error,
      });
      return NextResponse.json(
        {
          sent: false,
          error: `The report email could not be sent: ${result.error}`,
          code: "SEND_FAILED",
        },
        { status: 502 },
      );
    }

    await recordMonthlyReportDelivery({
      reportId,
      mainRecipient: to,
      ccRecipients: cc,
      sentBy: authorization.teacher.profileId,
      status: "sent",
      providerMessageId: result.id,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Unexpected error while sending a monthly report:", { reportId, error });
    return NextResponse.json(
      { error: "Unable to send the report. Please try again.", code: "SEND_FAILED" },
      { status: 500 },
    );
  }
}
