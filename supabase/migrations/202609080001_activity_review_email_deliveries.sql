-- AD Astra activity review-return email reliability repair.
--
-- Append-only audit trail for every review-return email NOTIFICATION
-- ATTEMPT (never the underlying review/finalisation itself, which is
-- authoritative and recorded on activity_submissions regardless of what
-- happens here). This is the exact reliability/observability gap
-- identified during investigation: review_returned_email_claimed_at /
-- review_returned_email_sent_at on activity_submissions can only ever
-- show the CURRENT state (attempted vs not, sent vs not) -- they cannot
-- explain WHY a past attempt did or didn't succeed once a claim has been
-- released. This table exists to answer exactly that question, mirroring
-- the already-proven monthly_report_deliveries pattern (Stage 4C) rather
-- than inventing a new shape.
--
-- One row per genuine attempt outcome: 'sent', 'failed', or 'skipped'.
-- Deliberately NOT written for a lost-race/idempotent re-entry
-- ("already_claimed_or_sent") -- that is not a real attempt, and
-- recording it would misrepresent a no-op as a distinct outcome and fill
-- this table with noise (see lib/email/reviewReturnEmail.ts's own
-- comment on this decision). Structured server logging covers that case
-- instead.
create table if not exists public.activity_review_email_deliveries (
  id uuid primary key default gen_random_uuid(),

  submission_id uuid not null references public.activity_submissions(id) on delete cascade,

  -- learner_id follows the same convention as activity_submissions.learner_id:
  -- the learner's auth.users id, never profiles.id or learner_profiles.id.
  learner_id uuid not null references auth.users(id) on delete restrict,

  -- Nullable and best-effort: an attempt can fail before the activity or
  -- subject is ever resolved (e.g. the atomic claim itself errors), and
  -- this table must still record that outcome with whatever context was
  -- actually available at the time -- never block recording the attempt
  -- just because full context wasn't resolvable.
  activity_id uuid null references public.activities(id) on delete set null,
  subject_id uuid null references public.subjects(id) on delete set null,

  -- The resolved recipient address for this attempt. Null when recipient
  -- resolution itself is what failed (e.g. 'no_learner_email'). No other
  -- learner profile detail, and never the email body/HTML, is stored here.
  recipient_email text null,

  status text not null
    check (status in ('sent', 'failed', 'skipped')),

  -- A short, sanitized machine/human-readable reason -- required for
  -- every non-'sent' row (see check constraint below), e.g.
  -- "no_learner_email", "activity_resolution_failed", or a provider
  -- error's own message. Never a raw provider payload or secret.
  reason text null,

  -- Only ever populated for status = 'sent' -- Resend's own message id,
  -- useful for cross-referencing with the provider's own dashboard.
  provider_message_id text null,

  created_at timestamptz not null default now(),

  constraint activity_review_email_deliveries_reason_required_unless_sent check (
    status = 'sent' or reason is not null
  )
);

-- The natural lookup shape: "every attempt for this submission, most
-- recent first" -- both for a future targeted retry decision and for
-- manual investigation.
create index if not exists activity_review_email_deliveries_submission_idx
  on public.activity_review_email_deliveries (submission_id, created_at desc);

alter table public.activity_review_email_deliveries enable row level security;

-- No policies at all, for either role: every read/write goes through the
-- admin (service-role) client from server-only code
-- (lib/email/reviewReturnEmail.ts) -- there is no teacher- or
-- learner-facing route that reads this table in this stage. With RLS
-- enabled and zero matching policies, every authenticated/anon request is
-- denied by default. This table must never be exposed to learners --
-- explicitly revoking both roles' default privileges (rather than relying
-- on RLS alone) matches this codebase's existing defense-in-depth
-- convention for every other new table.
revoke all on table public.activity_review_email_deliveries from anon;
revoke all on table public.activity_review_email_deliveries from authenticated;

comment on table public.activity_review_email_deliveries is
  'Append-only audit trail of every review-return email notification attempt (sent/failed/skipped) for an activity submission. Service-role access only -- never exposed to authenticated or anon roles.';

notify pgrst, 'reload schema';
