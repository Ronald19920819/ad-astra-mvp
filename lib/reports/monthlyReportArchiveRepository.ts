import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import type { MonthlyReportBadgeKey } from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
//
// A deliberately lean reader for the archive LIST view only -- it never
// selects report_snapshot (the full frozen payload), kingdom_comments, or
// teacher_edited_comments, since an archive card only ever shows the
// small set of fields listed in MonthlyReportArchiveEntry below. Opening
// a specific report for full reading goes through
// findFinalisedMonthlyReportById (monthlyReportRepository.ts) instead --
// this file exists purely to make the LIST cheap regardless of how many
// finalised reports accumulate over time.

export type MonthlyReportArchiveEntry = {
  id: string;
  learnerId: string;
  learnerName: string;
  subjectId: string;
  subjectName: string;
  reportMonth: string;
  badge: MonthlyReportBadgeKey | null;
  finalisedAt: string | null;
};

export type MonthlyReportArchiveFilters = {
  // The teacher's own authorised subject IDs -- ALWAYS applied, regardless
  // of what the caller additionally requests via `subjectId` below. This
  // is what stops a teacher from ever seeing another subject's finalised
  // reports merely by asking.
  subjectIds: readonly string[];
  year?: number;
  month?: number; // 1-12
  subjectId?: string;
  search?: string;
};

// The distinct set of calendar years that actually have at least one
// finalised report the teacher is authorised to see -- used to default
// the Academic Year filter to the most recent year with real data, rather
// than an arbitrary "current year" that might have nothing in it yet, or
// an unfiltered list that could be overwhelming.
export async function listFinalisedMonthlyReportYears(
  subjectIds: readonly string[],
): Promise<number[]> {
  if (subjectIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("report_month")
    .eq("status", "finalised")
    .in("subject_id", subjectIds);
  if (error) throw error;

  const years = new Set((data ?? []).map((row) => Number(row.report_month.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export async function listFinalisedMonthlyReportArchive(
  filters: MonthlyReportArchiveFilters,
): Promise<MonthlyReportArchiveEntry[]> {
  const { subjectIds, year, month, subjectId, search } = filters;
  if (subjectIds.length === 0) return [];

  // A requested subjectId is only ever honoured if it's actually within
  // the caller's authorised set -- defense in depth, independent of
  // whatever validation the calling route already performed.
  const scopedSubjectIds = subjectId
    ? subjectIds.filter((id) => id === subjectId)
    : subjectIds;
  if (scopedSubjectIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("monthly_reports")
    .select("id, learner_id, subject_id, report_month, badge, finalised_at")
    .eq("status", "finalised")
    .in("subject_id", scopedSubjectIds);

  if (year !== undefined) {
    query = query
      .gte("report_month", `${year}-01-01`)
      .lt("report_month", `${year + 1}-01-01`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = data ?? [];
  if (month !== undefined) {
    const monthPrefix = String(month).padStart(2, "0");
    rows = rows.filter((row) => row.report_month.slice(5, 7) === monthPrefix);
  }
  if (rows.length === 0) return [];

  const learnerIds = [...new Set(rows.map((row) => row.learner_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("auth_user_id, full_name")
    .eq("role", "learner")
    .in("auth_user_id", learnerIds);
  if (profilesError) throw profilesError;

  const learnerNameByAuthUserId = new Map(
    (profiles ?? []).map((profile) => [
      profile.auth_user_id as string,
      typeof profile.full_name === "string" && profile.full_name.trim()
        ? profile.full_name.trim()
        : "Learner",
    ]),
  );

  let entries: MonthlyReportArchiveEntry[] = rows.map((row) => ({
    id: row.id,
    learnerId: row.learner_id,
    learnerName: learnerNameByAuthUserId.get(row.learner_id) ?? "Learner",
    subjectId: row.subject_id,
    subjectName: getSubjectConfigurationByDatabaseId(row.subject_id)?.displayName ?? "Subject",
    reportMonth: row.report_month,
    badge: row.badge as MonthlyReportBadgeKey | null,
    finalisedAt: row.finalised_at,
  }));

  // Learner search matches against the learner's full display name --
  // since that name is "First Surname", a substring search naturally
  // matches on either name or surname without a separate column lookup.
  const trimmedSearch = search?.trim().toLowerCase();
  if (trimmedSearch) {
    entries = entries.filter((entry) => entry.learnerName.toLowerCase().includes(trimmedSearch));
  }

  // Deterministic sort -- never relies on database insertion order:
  // newest reporting period first; within the same period, alphabetical
  // by subject, then alphabetical by learner name.
  entries.sort((a, b) => {
    if (a.reportMonth !== b.reportMonth) {
      return a.reportMonth < b.reportMonth ? 1 : -1;
    }
    if (a.subjectName !== b.subjectName) {
      return a.subjectName.localeCompare(b.subjectName);
    }
    return a.learnerName.localeCompare(b.learnerName);
  });

  return entries;
}
