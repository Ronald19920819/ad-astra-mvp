-- AD Astra Monthly Learner Report -- Stage 4C: public report link +
-- email recipient delivery.
--
-- Two new tables, both scoped to an existing monthly_reports row and
-- reusing the exact can_manage_subject_reports(subject_id) authorisation
-- function already established in 202609010001_monthly_reports.sql
-- (joined through monthly_reports.subject_id, since neither new table
-- carries its own subject_id -- one report, one subject, no duplication).
--
-- monthly_report_shares: the public access grant for ONE finalised report.
--
-- Stores the raw, high-entropy share token directly (NOT a one-way hash
-- of it) -- a deliberate departure from this codebase's existing hashed-
-- content-addressing convention (lib/accessibility/contentHash.ts),
-- documented here because it was a real design decision, not an
-- oversight. A one-way hash cannot be reversed, so it can only ever
-- support CREATING a token and later CHECKING an incoming one against
-- it -- it cannot support RETRIEVING the working link again later for a
-- resend. This report may legitimately be resent (to the same or
-- additional recipients) days or weeks after the link was first created,
-- and an already-delivered link must keep working across those resends
-- unless the teacher explicitly disables it -- rotating the token on
-- every send would silently break a link a parent already received,
-- which is a worse outcome than the narrower risk a plaintext-but-
-- access-controlled token accepts (a reader with direct database access
-- could reconstruct a working link without already holding one; RLS +
-- service-role-only access already govern every other sensitive column
-- in this schema the same way). The token's 256 bits of entropy is what
-- actually defends against guessing/enumeration -- a lookup by exact
-- token match is equally infeasible to brute-force whether the stored
-- value is hashed or not. A dedicated table (rather than a column on
-- monthly_reports) still exists so a disabled link's row can be revoked
-- and kept for history while a genuinely new token gets its own row --
-- restoring a revoked token is never offered as an action, by design.
-- At most one ACTIVE share may exist per report at a time (enforced by
-- the partial unique index below), so "the current link" is always
-- unambiguous.
create table if not exists public.monthly_report_shares (
  id uuid primary key default gen_random_uuid(),

  report_id uuid not null references public.monthly_reports(id) on delete cascade,

  -- The raw, high-entropy (256-bit) token that appears in the public
  -- report URL. See this table's own header comment for why this is
  -- deliberately not hashed.
  token text not null unique,

  status text not null default 'active'
    check (status in ('active', 'revoked')),

  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,

  constraint monthly_report_shares_revoked_requires_timestamp check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

create index if not exists monthly_report_shares_report_idx
  on public.monthly_report_shares (report_id);

-- At most one ACTIVE share per report -- revoking is required before a
-- new one can be created for the same report, which is exactly the
-- "regenerate = revoke old, create new" flow this stage's product design
-- calls for.
create unique index if not exists monthly_report_shares_one_active_per_report
  on public.monthly_report_shares (report_id)
  where status = 'active';

alter table public.monthly_report_shares enable row level security;

create policy "Authorised teachers can read their subject's report shares"
  on public.monthly_report_shares
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_shares.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  );

create policy "Authorised teachers can create shares for their subject's reports"
  on public.monthly_report_shares
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_shares.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  );

create policy "Authorised teachers can revoke their subject's report shares"
  on public.monthly_report_shares
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_shares.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  )
  with check (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_shares.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  );

-- No public/anon policy at all: the public report page looks up a share
-- exclusively via the admin (service-role) client, exactly like every
-- other read in this codebase's report system -- never a direct
-- anon-role PostgREST query. With RLS enabled and no anon policy, an
-- anon request is denied by default.
revoke all on table public.monthly_report_shares from anon;
grant select, insert, update
  on table public.monthly_report_shares
  to authenticated;

comment on table public.monthly_report_shares is
  'Public access grant for one finalised monthly report. Stores the raw share token (see table comment for why); at most one row per report may be active at a time.';

-- monthly_report_deliveries: append-only send history. A report may be
-- (re)sent multiple times, to different recipients, over its lifetime --
-- this is deliberately a history table, never a single sent_at/recipient
-- pair bolted onto monthly_reports, so a resend can never overwrite the
-- record of an earlier send.
create table if not exists public.monthly_report_deliveries (
  id uuid primary key default gen_random_uuid(),

  report_id uuid not null references public.monthly_reports(id) on delete cascade,

  main_recipient text not null,
  cc_recipients text[] not null default '{}',

  sent_by uuid not null references public.profiles(id) on delete restrict,
  sent_at timestamptz not null default now(),

  provider_message_id text null,

  status text not null check (status in ('sent', 'failed')),
  failure_message text null,

  constraint monthly_report_deliveries_failed_requires_message check (
    (status = 'failed') = (failure_message is not null)
  )
);

create index if not exists monthly_report_deliveries_report_idx
  on public.monthly_report_deliveries (report_id, sent_at desc);

alter table public.monthly_report_deliveries enable row level security;

create policy "Authorised teachers can read their subject's delivery history"
  on public.monthly_report_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_deliveries.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  );

create policy "Authorised teachers can record deliveries for their subject's reports"
  on public.monthly_report_deliveries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.monthly_reports
      where monthly_reports.id = monthly_report_deliveries.report_id
        and public.can_manage_subject_reports(monthly_reports.subject_id)
    )
  );

-- No update/delete policy: a delivery-history row is append-only and
-- immutable once written, exactly like a finalised report's own snapshot.

revoke all on table public.monthly_report_deliveries from anon;
grant select, insert
  on table public.monthly_report_deliveries
  to authenticated;

comment on table public.monthly_report_deliveries is
  'Append-only send history for monthly reports. One row per send attempt (success or failure); a resend always inserts a new row, never overwrites a prior one.';

notify pgrst, 'reload schema';
