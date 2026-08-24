-- Reconciles public.subject_events / public.subject_announcements after a
-- stale copy of 202607280002_subject_events_and_announcements.sql (which
-- still expected event_at/expires_on) was re-run against production. That
-- table was already carried forward to the event_date-only shape by
-- 202607280003_subject_events_date_only.sql and
-- 202607280004_subject_events_event_date_alignment.sql, so `create table if
-- not exists` no-opped and the later `create index ... (event_at)`
-- statement failed with 42703 -- event_at no longer exists.
--
-- Investigation confirmed the CURRENT application code
-- (lib/supabase/subjectCommunications.ts, app/api/teacher/subject-events)
-- reads and writes event_date exclusively; event_at/expires_on are not
-- required by any current implementation. This migration therefore does
-- NOT reintroduce those columns. It only:
--   1. defensively reconciles subject_events back to the event_date-only
--      shape if event_at/expires_on somehow exist (safe no-op otherwise --
--      live inspection confirmed they do not, and one existing event row
--      was found with event_date already populated);
--   2. re-asserts the index/RLS/policies/trigger/grants that 002 defined
--      for subject_events, in case any were dropped or never committed;
--   3. re-asserts UNIQUE(subject_id)/RLS/policies/trigger/grants for
--      subject_announcements, in case the original run did not fully
--      commit -- adding only what is verified missing.
--
-- Every statement is guarded (IF EXISTS / IF NOT EXISTS / DO-block checks
-- / DROP POLICY IF EXISTS before CREATE POLICY / CREATE OR REPLACE) so
-- this file is safe to run regardless of how much of the earlier failed
-- script actually committed, and safe to run more than once. No table is
-- dropped and no row is deleted.

-- ---------------------------------------------------------------------
-- 1. subject_events: guarantee the event_date-only shape, without
--    destroying any existing event_date data.
-- ---------------------------------------------------------------------

alter table public.subject_events
  add column if not exists event_date date;

-- Only runs if a stale event_at/expires_on column is actually present
-- (defensive; current production state does not have them).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subject_events' and column_name = 'event_at'
  ) then
    execute $sql$
      update public.subject_events
      set event_date = coalesce(event_date, (event_at at time zone 'Africa/Johannesburg')::date)
      where event_date is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subject_events' and column_name = 'expires_on'
  ) then
    execute $sql$
      update public.subject_events
      set event_date = coalesce(event_date, expires_on)
      where event_date is null
    $sql$;
  end if;
end
$$;

-- Guard: only enforce NOT NULL once every row genuinely has a value, so
-- this can never fail against real data.
do $$
begin
  if not exists (select 1 from public.subject_events where event_date is null) then
    alter table public.subject_events alter column event_date set not null;
  end if;
end
$$;

drop index if exists subject_events_subject_event_idx;
drop index if exists subject_events_subject_expiry_idx;

create index if not exists subject_events_subject_event_date_idx
  on public.subject_events (subject_id, event_date);

alter table public.subject_events
  drop column if exists event_at,
  drop column if exists expires_on;

comment on table public.subject_events is
  'Teacher-managed subject events that store one actual event date and an optional short description.';

-- ---------------------------------------------------------------------
-- 2. subject_events: re-assert RLS / policies / trigger / grants (safe
--    no-ops if already present).
-- ---------------------------------------------------------------------

alter table public.subject_events enable row level security;

drop policy if exists "Authorised subject members can read subject events" on public.subject_events;
create policy "Authorised subject members can read subject events"
  on public.subject_events
  for select
  to authenticated
  using (public.can_read_subject_topics(subject_id));

drop policy if exists "Authorised teachers can create subject events" on public.subject_events;
create policy "Authorised teachers can create subject events"
  on public.subject_events
  for insert
  to authenticated
  with check (public.can_manage_subject_topics(subject_id));

drop policy if exists "Authorised teachers can update subject events" on public.subject_events;
create policy "Authorised teachers can update subject events"
  on public.subject_events
  for update
  to authenticated
  using (public.can_manage_subject_topics(subject_id))
  with check (public.can_manage_subject_topics(subject_id));

drop policy if exists "Authorised teachers can delete subject events" on public.subject_events;
create policy "Authorised teachers can delete subject events"
  on public.subject_events
  for delete
  to authenticated
  using (public.can_manage_subject_topics(subject_id));

revoke all on table public.subject_events from anon;
grant select, insert, update, delete on table public.subject_events to authenticated;

create or replace function public.set_subject_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subject_events_updated_at on public.subject_events;
create trigger set_subject_events_updated_at
  before update on public.subject_events
  for each row
  execute function public.set_subject_events_updated_at();

-- ---------------------------------------------------------------------
-- 3. subject_announcements: add only what is verified missing.
-- ---------------------------------------------------------------------

-- UNIQUE(subject_id) -- checked structurally (column-based, not by
-- assumed constraint name) so this is correct even if the original
-- auto-generated constraint name ever differs.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.subject_announcements'::regclass
      and c.contype = 'u'
      and c.conkey = (
        select array_agg(a.attnum order by a.attnum)
        from pg_attribute a
        where a.attrelid = 'public.subject_announcements'::regclass
          and a.attname = 'subject_id'
      )
  ) then
    alter table public.subject_announcements
      add constraint subject_announcements_subject_id_key unique (subject_id);
  end if;
end
$$;

create index if not exists subject_announcements_created_at_idx
  on public.subject_announcements (created_at desc);

alter table public.subject_announcements enable row level security;

drop policy if exists "Authorised subject members can read subject announcements" on public.subject_announcements;
create policy "Authorised subject members can read subject announcements"
  on public.subject_announcements
  for select
  to authenticated
  using (public.can_read_subject_topics(subject_id));

drop policy if exists "Authorised teachers can create subject announcements" on public.subject_announcements;
create policy "Authorised teachers can create subject announcements"
  on public.subject_announcements
  for insert
  to authenticated
  with check (public.can_manage_subject_topics(subject_id));

drop policy if exists "Authorised teachers can update subject announcements" on public.subject_announcements;
create policy "Authorised teachers can update subject announcements"
  on public.subject_announcements
  for update
  to authenticated
  using (public.can_manage_subject_topics(subject_id))
  with check (public.can_manage_subject_topics(subject_id));

drop policy if exists "Authorised teachers can delete subject announcements" on public.subject_announcements;
create policy "Authorised teachers can delete subject announcements"
  on public.subject_announcements
  for delete
  to authenticated
  using (public.can_manage_subject_topics(subject_id));

revoke all on table public.subject_announcements from anon;
grant select, insert, update, delete on table public.subject_announcements to authenticated;

create or replace function public.set_subject_announcements_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subject_announcements_updated_at on public.subject_announcements;
create trigger set_subject_announcements_updated_at
  before update on public.subject_announcements
  for each row
  execute function public.set_subject_announcements_updated_at();

notify pgrst, 'reload schema';
