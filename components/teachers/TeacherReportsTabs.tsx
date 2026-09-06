"use client";

import { useState } from "react";
import { MonthlyReportGenerator } from "@/components/teachers/MonthlyReportGenerator";
import { MonthlyReportArchive } from "@/components/teachers/MonthlyReportArchive";

type ReportSubjectOption = {
  key: string;
  databaseId: string;
  displayName: string;
  colourTheme: { primary: string; softBackground: string; border: string };
};

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// The Reports area has exactly two modes -- Create Report (the existing
// generation workflow, unchanged) and Finalised Reports (the new
// historical archive) -- rather than a separate top-level teacher
// navigation destination, per this stage's own product-structure
// requirement. `initialTab` lets a deep link (e.g. the historical report
// page's "Back to Finalised Reports" link) land directly on the archive
// tab without a client-side redirect round-trip.
export function TeacherReportsTabs({
  subjects,
  initialTab,
}: {
  subjects: ReportSubjectOption[];
  initialTab: "create" | "archive";
}) {
  const [tab, setTab] = useState<"create" | "archive">(initialTab);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-full bg-white p-1 shadow-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          onClick={() => setTab("create")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            tab === "create" ? "bg-[#102A43] text-white" : "text-[#102A43]"
          }`}
        >
          Create Report
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "archive"}
          onClick={() => setTab("archive")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            tab === "archive" ? "bg-[#102A43] text-white" : "text-[#102A43]"
          }`}
        >
          Finalised Reports
        </button>
      </div>

      {tab === "create" ? (
        <MonthlyReportGenerator subjects={subjects} />
      ) : (
        <MonthlyReportArchive subjects={subjects} />
      )}
    </div>
  );
}
