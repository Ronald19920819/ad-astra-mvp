import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// AD ASTRA REVIEW-EMAIL RELIABILITY REPAIR: append-only audit trail for
// review-return email notification attempts. Mirrors the established
// monthlyReportDeliveryRepository.ts shape (Stage 4C) -- one row per
// genuine attempt outcome, never updated or deleted afterwards. The ONE
// caller is lib/email/reviewReturnEmail.ts; nothing else should write to
// this table.

export type ActivityReviewEmailDeliveryStatus = "sent" | "failed" | "skipped";

export type ActivityReviewEmailDeliveryRow = {
  id: string;
  submission_id: string;
  learner_id: string;
  activity_id: string | null;
  subject_id: string | null;
  recipient_email: string | null;
  status: ActivityReviewEmailDeliveryStatus;
  reason: string | null;
  provider_message_id: string | null;
  created_at: string;
};

export async function recordActivityReviewEmailDelivery(input: {
  submissionId: string;
  learnerId: string;
  activityId: string | null;
  subjectId: string | null;
  recipientEmail: string | null;
  status: ActivityReviewEmailDeliveryStatus;
  reason?: string | null;
  providerMessageId?: string | null;
}): Promise<ActivityReviewEmailDeliveryRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("activity_review_email_deliveries")
    .insert({
      submission_id: input.submissionId,
      learner_id: input.learnerId,
      activity_id: input.activityId,
      subject_id: input.subjectId,
      recipient_email: input.recipientEmail,
      status: input.status,
      reason: input.reason ?? null,
      provider_message_id: input.providerMessageId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityReviewEmailDeliveryRow;
}

// Read-only helper for a future, EXPLICIT, single-submission retry
// decision (per this stage's own scope: no blanket reconciliation scan is
// ever built). Returns every recorded attempt for one submission, most
// recent first -- deliberately not exported alongside any bulk/"all
// failed submissions" query, which is exactly the blanket-scan shape this
// stage must not introduce.
export async function listActivityReviewEmailDeliveriesForSubmission(
  submissionId: string,
): Promise<ActivityReviewEmailDeliveryRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("activity_review_email_deliveries")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityReviewEmailDeliveryRow[];
}
