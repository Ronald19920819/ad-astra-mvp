// Pure template builder -- no "server-only", no Resend, no database access.
// Deliberately dependency-light (plain HTML strings, no React Email) per
// AD ASTRA OPERATIONAL EMAIL STAGE 3. Receives only the small set of
// display data it needs; never the mark, percentage, performance badge,
// teacher's overall comment, question-level feedback, or any answer
// content -- the learner must open AD Astra to see any of that.

export type ReviewReturnedEmailData = {
  learnerFirstName: string;
  teacherFirstName: string | null;
  subjectName: string;
  activityTitle: string;
  reviewedWorkUrl: string;
};

export type BuiltEmail = {
  subject: string;
  html: string;
};

export function buildReviewReturnedEmail(
  data: ReviewReturnedEmailData,
): BuiltEmail {
  const subject = `Your ${data.subjectName} ${data.activityTitle} has been reviewed`;
  const teacherLine = data.teacherFirstName
    ? `Teacher ${data.teacherFirstName} has`
    : "Your teacher has";

  const html = `
<div style="background-color:#EEF7FF;padding:32px 16px;font-family:Arial, Helvetica, sans-serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background-color:#102A43;padding:22px 28px;">
      <p style="margin:0;color:#FEC20C;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">AD Astra</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px 0;color:#0f172a;font-size:16px;line-height:1.5;">Hi ${data.learnerFirstName},</p>
      <p style="margin:0 0 16px 0;color:#0f172a;font-size:16px;line-height:1.5;">${teacherLine} reviewed your ${data.subjectName} ${data.activityTitle}.</p>
      <p style="margin:0 0 24px 0;color:#334155;font-size:15px;line-height:1.6;">Your feedback is ready in AD Astra. Reviewing your feedback will help you understand what you did well and what you can improve.</p>
      <a href="${data.reviewedWorkUrl}" style="display:inline-block;background-color:#FEC20C;color:#102A43;font-weight:700;font-size:15px;padding:12px 26px;border-radius:999px;text-decoration:none;">View My Reviewed Work</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E2E8F0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">AD Astra</p>
    </div>
  </div>
</div>
`.trim();

  return { subject, html };
}
