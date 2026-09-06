import { getReportBySharetoken } from "@/lib/reports/monthlyReportShareRepository";
import { resolveDisplayedMonthlyReportComments } from "@/lib/reports/kingdomMonthlyReport";
import { PublicMonthlyReportView } from "@/components/reports/PublicMonthlyReportView";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK. A Server
// Component that fetches DIRECTLY via getReportBySharetoken -- never a
// client-side call to a generic JSON API -- so the frozen
// report_snapshot is never exposed as raw fetchable JSON, and the
// token-gated lookup stays entirely server-side. Renders strictly from
// report_snapshot + the frozen approved commentary; NEVER calls the live
// Monthly Report engine (getReportBySharetoken only ever returns an
// already-finalised row, whose snapshot is immutable by construction --
// see monthlyReportRepository.ts's finalizeMonthlyReport).
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

export default async function PublicMonthlyReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!TOKEN_PATTERN.test(token)) {
    return <ReportUnavailable />;
  }

  const report = await getReportBySharetoken(token);
  if (!report || !report.report_snapshot) {
    return <ReportUnavailable />;
  }

  const comments = resolveDisplayedMonthlyReportComments({
    kingdomComments: report.kingdom_comments,
    teacherEditedComments: report.teacher_edited_comments,
  });

  return <PublicMonthlyReportView report={report.report_snapshot} comments={comments} />;
}

function ReportUnavailable() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[#EEF7FF] px-4 py-16">
      <div className="max-w-md rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-[#102A43]">Report Unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This report link is no longer available. It may have been disabled, or the link may be
          incorrect. Please contact the learner&apos;s teacher for assistance.
        </p>
      </div>
    </div>
  );
}
