-- AD Astra operational email Stage 3: race-safe idempotency tracking for
-- the teacher-review-returned learner email. Two independent nullable
-- timestamps, never reviewed_at (which is legitimately overwritten every
-- time a returned review is re-saved/edited, so it cannot double as an
-- email-sent marker):
--
--   review_returned_email_claimed_at = a request has temporarily claimed
--     the right to send this submission's email. Not proof of delivery.
--   review_returned_email_sent_at = Resend actually accepted the email.
--
-- This migration adds the columns only. It deliberately does NOT backfill
-- either column for existing "returned" rows -- historical returns must
-- never generate an email, and a null timestamp on old work is not
-- evidence that an email is owed; it simply predates this feature.
alter table public.activity_submissions
  add column if not exists review_returned_email_claimed_at timestamptz null;

alter table public.activity_submissions
  add column if not exists review_returned_email_sent_at timestamptz null;
