// Pure template builder -- no "server-only", no Resend, no database
// access. Matches the exact visual language already established in
// lib/email/templates/reviewReturned.ts (navy header, white body, gold
// pill call-to-action, muted footer) for a consistent AD Astra identity
// across every operational email.
//
// AD ASTRA MONTHLY REPORT -- STAGE 4C: deliberately minimal. Never
// includes the academic result, badge, topic breakdown, or any
// commentary -- the report itself lives behind the link; this email only
// announces that it exists and where to find it.

export type MonthlyReportDeliveryEmailData = {
  learnerName: string;
  subjectName: string;
  reportMonthLabel: string;
  reportUrl: string;
};

export type BuiltEmail = {
  subject: string;
  html: string;
};

export function buildMonthlyReportDeliveryEmail(
  data: MonthlyReportDeliveryEmailData,
): BuiltEmail {
  const subject = `Monthly Progress Report — ${data.learnerName} — ${data.subjectName} — ${data.reportMonthLabel}`;

  const html = `
<div style="background-color:#EEF7FF;padding:32px 16px;font-family:Arial, Helvetica, sans-serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background-color:#102A43;padding:22px 28px;">
      <p style="margin:0;color:#FEC20C;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">AD Astra</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px 0;color:#0f172a;font-size:16px;line-height:1.5;">Your AD Astra Monthly Progress Report is now available.</p>
      <p style="margin:0 0 24px 0;color:#334155;font-size:15px;line-height:1.6;">
        <strong>${data.learnerName}</strong> — ${data.subjectName} — ${data.reportMonthLabel}
      </p>
      <a href="${data.reportUrl}" style="display:inline-block;background-color:#FEC20C;color:#102A43;font-weight:700;font-size:15px;padding:12px 26px;border-radius:999px;text-decoration:none;">View Progress Report</a>
      <p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">This link provides read-only access to this finalised report. No AD Astra account or login is required.</p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E2E8F0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">AD Astra</p>
    </div>
  </div>
</div>
`.trim();

  return { subject, html };
}
