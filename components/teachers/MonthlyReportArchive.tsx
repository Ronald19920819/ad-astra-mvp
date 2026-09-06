"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatReportMonthLabel } from "@/lib/reports/monthlyReportMonth";
import { resolveMonthlyReportBadgeAsset } from "@/lib/reports/monthlyReportBadgeAsset";
import type { MonthlyReportArchiveEntry } from "@/lib/reports/monthlyReportArchiveRepository";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function formatFinalisedDate(finalisedAt: string | null): string {
  if (!finalisedAt) return "Unknown";
  return new Date(finalisedAt).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ReportSubjectOption = {
  databaseId: string;
  displayName: string;
};

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// The historical browse/search view: Academic Year -> Reporting Month ->
// Subject -> Learner, achieved with flat filtering controls rather than
// nested folders. Every fetch goes through the server-authorised
// /api/teacher/reports/archive route -- this component holds no report
// content itself, only the lean list metadata that route returns.
export function MonthlyReportArchive({ subjects }: { subjects: ReportSubjectOption[] }) {
  const [years, setYears] = useState<number[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [selectedMonth, setSelectedMonth] = useState<number | "">("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [search, setSearch] = useState("");

  const [entries, setEntries] = useState<MonthlyReportArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Step 1: discover which academic years actually have finalised
  // reports, and default to the most recent one -- a sensible recent
  // view rather than an overwhelming unfiltered list on first load.
  useEffect(() => {
    let cancelled = false;

    async function loadYears() {
      try {
        const res = await fetch("/api/teacher/reports/archive");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Unable to load the report archive.");
        const availableYears: number[] = data.years ?? [];
        setYears(availableYears);
        if (availableYears.length > 0) {
          setSelectedYear(availableYears[0]);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load the report archive.");
          setYears([]);
          setLoading(false);
        }
      }
    }

    void loadYears();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2: load the filtered entry list -- only once the default year
  // has been established (or the teacher has genuinely chosen "All
  // Years"), and again every time a filter changes.
  useEffect(() => {
    if (years === null) return;

    let cancelled = false;

    async function loadEntries() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedYear !== "") params.set("year", String(selectedYear));
        if (selectedMonth !== "") params.set("month", String(selectedMonth));
        if (selectedSubjectId) params.set("subjectId", selectedSubjectId);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/teacher/reports/archive?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Unable to load the report archive.");
        setEntries(data.entries ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load the report archive.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [years, selectedYear, selectedMonth, selectedSubjectId, search]);

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-[#102A43]">Finalised Reports</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Academic Year</p>
            <select
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(event.target.value ? Number(event.target.value) : "")
              }
              disabled={!years || years.length === 0}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1] disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">All Years</option>
              {(years ?? []).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Reporting Month</p>
            <select
              value={selectedMonth}
              onChange={(event) =>
                setSelectedMonth(event.target.value ? Number(event.target.value) : "")
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            >
              <option value="">All Months</option>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Subject</p>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            >
              <option value="">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.databaseId} value={subject.databaseId}>
                  {subject.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Search Learner</p>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or surname"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
          </label>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-100 bg-white p-4 text-sm font-semibold text-red-700 shadow-sm">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading finalised reports…</p>
      ) : years && years.length === 0 ? (
        <p className="rounded-[2rem] border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No reports have been finalised yet. Finalised reports will appear here once you finalise
          one from Create Report.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-[2rem] border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No finalised reports match these filters.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const badgeAsset = resolveMonthlyReportBadgeAsset(entry.badge);
            return (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {badgeAsset ? (
                    <Image
                      src={badgeAsset.src}
                      alt={badgeAsset.alt}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 object-contain"
                    />
                  ) : null}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{entry.learnerName}</p>
                    <p className="text-xs text-slate-500">
                      {entry.subjectName} · {formatReportMonthLabel(entry.reportMonth)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {badgeAsset?.label ?? "Badge unavailable"} · Finalised{" "}
                      {formatFinalisedDate(entry.finalisedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/teacher/reports/${entry.id}`}
                    className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43]"
                  >
                    Open Report
                  </Link>
                  <Link
                    href={`/teacher/reports/${entry.id}#send-progress-report`}
                    className="rounded-2xl bg-[#102A43] px-4 py-2 text-xs font-bold text-white"
                  >
                    Send / Resend
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
