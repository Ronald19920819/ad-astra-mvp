import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/reports/monthlyReportShareToken";
import { getMonthlyReportById, type MonthlyReportRow } from "@/lib/reports/monthlyReportRepository";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK.
//
// A dedicated repository for monthly_report_shares, separate from
// monthlyReportRepository.ts -- a different table, a different concern
// (public access grants, not the report's own draft/finalised lifecycle),
// and critically a different TRUST BOUNDARY: getReportBySharetoken below
// is the one function in this whole codebase that resolves a report from
// completely unauthenticated input (a URL token), so it lives somewhere
// that makes that boundary obvious rather than being buried alongside
// every teacher-authenticated report mutation.

export type MonthlyReportShareRow = {
  id: string;
  report_id: string;
  token: string;
  status: "active" | "revoked";
  created_by: string;
  created_at: string;
  revoked_at: string | null;
};

export async function getActiveShareForReport(
  reportId: string,
): Promise<MonthlyReportShareRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_report_shares")
    .select("*")
    .eq("report_id", reportId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyReportShareRow | null;
}

// Creates a brand-new active share. The database's own partial unique
// index (one active share per report) rejects this at the constraint
// level if an active share already exists; callers that want "ensure a
// share exists" vs "revoke then recreate" semantics decide which by
// revoking first (or not) before calling this.
export async function createShareForReport({
  reportId,
  createdBy,
}: {
  reportId: string;
  createdBy: string;
}): Promise<MonthlyReportShareRow> {
  const token = generateShareToken();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_report_shares")
    .insert({
      report_id: reportId,
      token,
      status: "active",
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  return data as MonthlyReportShareRow;
}

// Revokes whatever share is currently active for this report, if any.
// Idempotent: revoking with nothing active is a safe no-op, never an
// error. Never deletes the row -- a revoked share stays in the table as
// a permanent record that this exact link existed and was disabled.
export async function revokeActiveShareForReport(
  reportId: string,
): Promise<MonthlyReportShareRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_report_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("report_id", reportId)
    .eq("status", "active")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyReportShareRow | null;
}

// THE public entry point. Looks up an ACTIVE share by exact token match,
// then confirms the linked report is still FINALISED (a report can never
// be un-finalised, but this is checked explicitly rather than assumed) --
// returning null (never throwing, and never distinguishing "no such
// token" from "revoked" from "somehow not finalised" in what it returns)
// for any reason access should be denied. The caller must render exactly
// the same "unavailable" outcome for null regardless of which of these
// was the real reason, so a token guess gains no information about why
// it failed.
export async function getReportBySharetoken(
  token: string,
): Promise<MonthlyReportRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data: share, error } = await supabase
    .from("monthly_report_shares")
    .select("report_id")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!share) return null;

  const report = await getMonthlyReportById(share.report_id);
  if (!report || report.status !== "finalised") return null;

  return report as MonthlyReportRow;
}
