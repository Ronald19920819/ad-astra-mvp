import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: append-only delivery history.
// recordMonthlyReportDelivery is called exactly once per send ATTEMPT
// (success or failure) -- never updated afterwards, and a resend always
// inserts a new row rather than touching an earlier one. This is what
// makes the history genuinely auditable: every attempt that was ever
// made stays visible, in order, forever.

export type MonthlyReportDeliveryRow = {
  id: string;
  report_id: string;
  main_recipient: string;
  cc_recipients: string[];
  sent_by: string;
  sent_at: string;
  provider_message_id: string | null;
  status: "sent" | "failed";
  failure_message: string | null;
};

export async function recordMonthlyReportDelivery(input: {
  reportId: string;
  mainRecipient: string;
  ccRecipients: readonly string[];
  sentBy: string;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  failureMessage?: string | null;
}): Promise<MonthlyReportDeliveryRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_report_deliveries")
    .insert({
      report_id: input.reportId,
      main_recipient: input.mainRecipient,
      cc_recipients: input.ccRecipients,
      sent_by: input.sentBy,
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      failure_message: input.failureMessage ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyReportDeliveryRow;
}

export async function listDeliveriesForReport(
  reportId: string,
): Promise<MonthlyReportDeliveryRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_report_deliveries")
    .select("*")
    .eq("report_id", reportId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthlyReportDeliveryRow[];
}
