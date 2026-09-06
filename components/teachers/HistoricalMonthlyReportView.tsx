"use client";

import { MonthlyReportPreview } from "@/components/teachers/MonthlyReportGenerator";
import type { MonthlyReportRow } from "@/lib/reports/monthlyReportRepository";

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// The internal, authenticated reader for reopening ONE previously
// finalised report (app/teacher/reports/[reportId]/page.tsx). This is
// NOT the public share-token route -- it requires the server-side
// teacher authentication/authorisation that page performs before this
// component ever renders.
//
// Deliberately thin: all of the actual presentation (frozen header/meta,
// badge, At a Glance, Progress by Topic, Included Work, Work Ethic &
// Engagement, Evidence Notes, Approved Commentary, Priorities, the
// Finalised status/date indicator, and the Stage 4C MonthlyReportDelivery
// send/link section) is the exact same MonthlyReportPreview component the
// live create-report workflow already renders once a report is finalised
// -- reused here rather than duplicated. Marked "use client" for the same
// reason PublicMonthlyReportView.tsx is: MonthlyReportPreview lives in a
// "use client" module, and reusing its exports safely requires being on
// the same side of the Server/Client boundary (see that file's own header
// comment for the full explanation of why this matters).
export function HistoricalMonthlyReportView({
  report,
  subjectColour,
}: {
  report: MonthlyReportRow;
  subjectColour: string;
}) {
  if (!report.report_snapshot) {
    // Structurally unreachable for a genuinely finalised row (the
    // database's own monthly_reports_finalised_requires_snapshot check
    // constraint guarantees a finalised report always has a snapshot),
    // but handled explicitly rather than asserted away.
    return (
      <p className="rounded-2xl border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
        This report has no frozen content and cannot be displayed.
      </p>
    );
  }

  return (
    <MonthlyReportPreview
      report={report.report_snapshot}
      subjectColour={subjectColour}
      draftId={report.id}
      reportStatus="finalised"
      finalisedAt={report.finalised_at}
      kingdomComments={report.kingdom_comments}
      teacherEditedComments={report.teacher_edited_comments}
      // Never actually invoked: every code path in MonthlyReportPreview
      // that calls onDraftUpdated (comment generation/editing, finalising)
      // is itself gated on `!isFinalised`, and reportStatus is fixed to
      // "finalised" here -- there is deliberately no live mutation path
      // for a historical report to route back through.
      onDraftUpdated={() => {}}
    />
  );
}
