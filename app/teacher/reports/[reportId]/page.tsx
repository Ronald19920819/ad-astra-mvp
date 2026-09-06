import Link from "next/link";
import { notFound } from "next/navigation";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import { findFinalisedMonthlyReportById } from "@/lib/reports/monthlyReportRepository";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { HistoricalMonthlyReportView } from "@/components/teachers/HistoricalMonthlyReportView";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// The INTERNAL, authenticated reader for reopening one historical
// finalised report -- NOT the public share-token route
// (app/report/[token]/page.tsx), which remains the only unauthenticated
// path to a report. Every request here:
//   1. loads the report via the FINALISED-ONLY reader (never a
//      status-agnostic lookup, never the live report engine -- a draft is
//      structurally unreachable through this route);
//   2. authorises the teacher against THAT report's own stored
//      subject_id (never a client-supplied value);
// and renders notFound() uniformly for "no such report", "not
// finalised", "not signed in", and "signed in but not authorised for
// this subject" -- knowing a report's UUID is never, by itself, enough
// to see it.
export default async function TeacherHistoricalReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  if (!uuidPattern.test(reportId)) {
    notFound();
  }

  const report = await findFinalisedMonthlyReportById(reportId);
  if (!report) {
    notFound();
  }

  const authorization = await authorizeTeacher(report.subject_id);
  if (!authorization.success) {
    notFound();
  }

  const subjectColour =
    getSubjectConfigurationByDatabaseId(report.subject_id)?.colourTheme.primary ?? "#102A43";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-16">
      <div className="mx-auto max-w-5xl space-y-4">
        <Link
          href="/teacher/reports?tab=archive"
          className="inline-block text-sm font-semibold text-[#508DB1]"
        >
          ← Back to Finalised Reports
        </Link>
        <HistoricalMonthlyReportView report={report} subjectColour={subjectColour} />
      </div>
    </main>
  );
}
