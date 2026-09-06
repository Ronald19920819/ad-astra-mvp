import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";
import { getLearnerProfileByAuthUserId } from "@/lib/supabase/learnerProfile";
import { getAbsoluteAppUrl } from "@/lib/email/appUrl";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildReviewReturnedEmail } from "@/lib/email/templates/reviewReturned";
import { recordActivityReviewEmailDelivery } from "@/lib/email/activityReviewEmailDeliveryRepository";

// AD ASTRA OPERATIONAL EMAIL STAGE 3: the one reusable, subject-agnostic
// trigger for the "teacher review returned" learner email. The single
// shared finalisation route (app/api/teacher/reviews/[submissionId]/route.ts,
// used by all four subjects) calls this -- never duplicate this logic in
// a subject-specific route.
//
// CALLER CONTRACT: this function must ONLY be invoked when the caller has
// already determined this is a genuine first-time transition into
// "returned" (i.e. the submission's status was NOT already "returned"
// immediately before the database write that just succeeded). This
// function's own atomic claim (below) prevents a DUPLICATE send for a
// given submission, but it cannot distinguish "genuine first return" from
// "historical row with untouched null tracking columns" -- a historical
// returned submission has never had this function called for it and must
// never have it called retroactively. There is deliberately no backfill,
// reconciliation job, or startup scan anywhere that calls this based on
// existing data.
//
// RELIABILITY REPAIR: every genuine attempt outcome (sent/failed/skipped)
// is now persisted via recordActivityReviewEmailDelivery
// (activity_review_email_deliveries) -- the exact gap identified during
// investigation, where a released claim left no trace of WHY a past
// attempt didn't succeed. The one deliberate exception is
// "already_claimed_or_sent": a lost-race/idempotent re-entry is not a
// genuine attempt, so recording it would misrepresent a no-op as a real
// outcome (see that branch below). This also makes a future EXPLICIT,
// single-submission retry possible: a submission whose most recent
// delivery row (or activity_submissions.review_returned_email_sent_at)
// shows no successful send, and which has no active claim, can safely
// have this function called again for its exact id -- never a blanket
// scan of every historical null.
export type ReviewReturnedEmailOutcome =
  | { sent: true }
  | { sent: false; reason: string };

type ClaimedSubmissionRow = {
  id: string;
  activity_id: string;
  activity_snapshot: ActivitySubmissionSnapshot | null;
  reviewed_by: string | null;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function releaseClaim(supabase: SupabaseAdminClient, submissionId: string) {
  const { error } = await supabase
    .from("activity_submissions")
    .update({ review_returned_email_claimed_at: null })
    .eq("id", submissionId);

  if (error) {
    console.error("Unable to release review-return email claim:", {
      submissionId,
      message: error.message,
    });
  }
}

// Mirrors the snapshot-preferred resolution already established in
// lib/supabase/learnerReturnedFeedback.ts: a valid activity_snapshot is
// authoritative; only a legacy pre-snapshot row needs the live
// activities -> lesson_materials -> lessons -> subjectConfig join chain.
async function resolveSubjectAndActivity(
  supabase: SupabaseAdminClient,
  activityId: string,
  snapshot: ActivitySubmissionSnapshot | null,
): Promise<{ subjectId: string; subjectName: string; activityTitle: string } | null> {
  if (snapshot) {
    return {
      subjectId: snapshot.subject.id,
      subjectName: snapshot.subject.name,
      activityTitle: snapshot.activity.title,
    };
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, title, lesson_material_id")
    .eq("id", activityId)
    .maybeSingle();
  if (activityError || !activity) return null;

  const { data: material, error: materialError } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id")
    .eq("id", activity.lesson_material_id)
    .maybeSingle();
  if (materialError || !material) return null;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, subject_id")
    .eq("id", material.lesson_id)
    .maybeSingle();
  if (lessonError || !lesson) return null;

  const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
  return {
    subjectId: lesson.subject_id,
    subjectName: subject?.displayName ?? "Subject",
    activityTitle: activity.title,
  };
}

// Mirrors the fallback order already used for this exact resolution in
// lib/supabase/learnerReturnedFeedback.ts's resolveTeacherFirstName:
// reviewed_by is profiles.id (not teacher_profiles.id -- see
// authorizeTeacher in lib/supabase/teacherAuth.ts), so a direct, minimal
// profiles lookup is the safe, proportionate path -- not the full
// teacher-profile/subject-assignment assembly in teacherProfile.ts, which
// would be disproportionate for a single display name.
async function resolveTeacherFirstName(
  supabase: SupabaseAdminClient,
  reviewedBy: string | null,
): Promise<string | null> {
  if (!reviewedBy) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, full_name")
    .eq("id", reviewedBy)
    .maybeSingle();
  if (error || !data) return null;

  const firstName = data.first_name?.trim();
  if (firstName) return firstName;

  const fullNameFirstToken = data.full_name?.trim().split(/\s+/)[0];
  return fullNameFirstToken || null;
}

export async function sendReviewReturnedEmailIfDue(
  learnerId: string,
  submissionId: string,
): Promise<ReviewReturnedEmailOutcome> {
  const supabase = createSupabaseAdminClient();

  // Atomic claim: only succeeds when both tracking columns are still
  // null, so two concurrent requests (or a retry) can never both win.
  // Conceptually: UPDATE ... SET claimed_at = now() WHERE id = :id AND
  // sent_at IS NULL AND claimed_at IS NULL.
  let claimedRow: ClaimedSubmissionRow | null;
  try {
    const { data, error } = await supabase
      .from("activity_submissions")
      .update({ review_returned_email_claimed_at: new Date().toISOString() })
      .eq("id", submissionId)
      .is("review_returned_email_sent_at", null)
      .is("review_returned_email_claimed_at", null)
      .select("id, activity_id, activity_snapshot, reviewed_by")
      .maybeSingle();

    if (error) throw error;
    claimedRow = data as ClaimedSubmissionRow | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Unable to claim review-return email:", {
      submissionId,
      message,
    });
    await recordActivityReviewEmailDelivery({
      submissionId,
      learnerId,
      activityId: null,
      subjectId: null,
      recipientEmail: null,
      status: "failed",
      reason: `claim_failed: ${message}`,
    });
    return { sent: false, reason: "claim_failed" };
  }

  if (!claimedRow) {
    // Lost the race, already sent, or (for a historical row) never
    // eligible in the first place -- skip silently either way. This is
    // an idempotency signal, not a genuine notification attempt, so it
    // is deliberately NOT persisted to the delivery-history table --
    // recording it would misrepresent a no-op as a real, distinct
    // outcome and fill the audit trail with noise (see the migration's
    // own comment on this decision).
    return { sent: false, reason: "already_claimed_or_sent" };
  }

  try {
    const learnerProfile = await getLearnerProfileByAuthUserId(learnerId);
    const learnerEmail = learnerProfile?.email;
    if (!learnerProfile || !learnerEmail) {
      await releaseClaim(supabase, submissionId);
      await recordActivityReviewEmailDelivery({
        submissionId,
        learnerId,
        activityId: claimedRow.activity_id,
        subjectId: null,
        recipientEmail: null,
        status: "skipped",
        reason: "no_learner_email",
      });
      return { sent: false, reason: "no_learner_email" };
    }

    const snapshot = isActivitySubmissionSnapshot(claimedRow.activity_snapshot)
      ? claimedRow.activity_snapshot
      : null;
    const subjectAndActivity = await resolveSubjectAndActivity(
      supabase,
      claimedRow.activity_id,
      snapshot,
    );
    if (!subjectAndActivity) {
      await releaseClaim(supabase, submissionId);
      await recordActivityReviewEmailDelivery({
        submissionId,
        learnerId,
        activityId: claimedRow.activity_id,
        subjectId: null,
        recipientEmail: learnerEmail,
        status: "skipped",
        reason: "activity_resolution_failed",
      });
      return { sent: false, reason: "activity_resolution_failed" };
    }

    const teacherFirstName = await resolveTeacherFirstName(
      supabase,
      claimedRow.reviewed_by,
    );

    const reviewedWorkUrl = getAbsoluteAppUrl(`/your-work/${submissionId}`);
    const { subject, html } = buildReviewReturnedEmail({
      learnerFirstName: learnerProfile.firstName,
      teacherFirstName,
      subjectName: subjectAndActivity.subjectName,
      activityTitle: subjectAndActivity.activityTitle,
      reviewedWorkUrl,
    });

    const result = await sendEmail({ to: learnerEmail, subject, html });

    if (!result.success) {
      console.error("Review-return email failed to send:", {
        submissionId,
        message: result.error,
      });
      await releaseClaim(supabase, submissionId);
      await recordActivityReviewEmailDelivery({
        submissionId,
        learnerId,
        activityId: claimedRow.activity_id,
        subjectId: subjectAndActivity.subjectId,
        recipientEmail: learnerEmail,
        status: "failed",
        reason: result.error,
      });
      return { sent: false, reason: "send_failed" };
    }

    const { error: markSentError } = await supabase
      .from("activity_submissions")
      .update({
        review_returned_email_sent_at: new Date().toISOString(),
        review_returned_email_claimed_at: null,
      })
      .eq("id", submissionId);

    if (markSentError) {
      console.error("Review-return email sent but sent_at could not be recorded:", {
        submissionId,
        message: markSentError.message,
      });
    }

    await recordActivityReviewEmailDelivery({
      submissionId,
      learnerId,
      activityId: claimedRow.activity_id,
      subjectId: subjectAndActivity.subjectId,
      recipientEmail: learnerEmail,
      status: "sent",
      providerMessageId: result.id,
    });

    return { sent: true };
  } catch (error) {
    console.error("Unexpected error while sending review-return email:", {
      submissionId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await releaseClaim(supabase, submissionId);
    await recordActivityReviewEmailDelivery({
      submissionId,
      learnerId,
      activityId: claimedRow.activity_id,
      subjectId: null,
      recipientEmail: null,
      status: "failed",
      reason: `unexpected_error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return { sent: false, reason: "unexpected_error" };
  }
}
