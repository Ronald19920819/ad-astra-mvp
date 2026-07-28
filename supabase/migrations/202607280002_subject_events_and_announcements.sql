create table if not exists public.subject_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_profile_id uuid not null references public.teacher_profiles(id) on delete restrict,
  title text not null check (
    length(btrim(title)) > 0
    and length(title) <= 200
  ),
  description text null check (
    description is null
    or length(btrim(description)) <= 500
  ),
  event_at timestamptz not null,
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subject_events_subject_event_idx
  on public.subject_events (subject_id, event_at);

create index if not exists subject_events_subject_expiry_idx
  on public.subject_events (subject_id, expires_on);

alter table public.subject_events enable row level security;

create policy "Authorised subject members can read subject events"
  on public.subject_events
  for select
  to authenticated
  using (public.can_read_subject_topics(subject_id));

create policy "Authorised teachers can create subject events"
  on public.subject_events
  for insert
  to authenticated
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can update subject events"
  on public.subject_events
  for update
  to authenticated
  using (public.can_manage_subject_topics(subject_id))
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can delete subject events"
  on public.subject_events
  for delete
  to authenticated
  using (public.can_manage_subject_topics(subject_id));

revoke all on table public.subject_events from anon;
grant select, insert, update, delete
  on table public.subject_events
  to authenticated;

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

drop trigger if exists set_subject_events_updated_at
  on public.subject_events;

create trigger set_subject_events_updated_at
  before update on public.subject_events
  for each row
  execute function public.set_subject_events_updated_at();

create table if not exists public.subject_announcements (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null unique references public.subjects(id) on delete cascade,
  teacher_profile_id uuid not null references public.teacher_profiles(id) on delete restrict,
  message text not null check (
    length(btrim(message)) > 0
    and length(btrim(message)) <= 1200
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subject_announcements_created_at_idx
  on public.subject_announcements (created_at desc);

alter table public.subject_announcements enable row level security;

create policy "Authorised subject members can read subject announcements"
  on public.subject_announcements
  for select
  to authenticated
  using (public.can_read_subject_topics(subject_id));

create policy "Authorised teachers can create subject announcements"
  on public.subject_announcements
  for insert
  to authenticated
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can update subject announcements"
  on public.subject_announcements
  for update
  to authenticated
  using (public.can_manage_subject_topics(subject_id))
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can delete subject announcements"
  on public.subject_announcements
  for delete
  to authenticated
  using (public.can_manage_subject_topics(subject_id));

revoke all on table public.subject_announcements from anon;
grant select, insert, update, delete
  on table public.subject_announcements
  to authenticated;

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

drop trigger if exists set_subject_announcements_updated_at
  on public.subject_announcements;

create trigger set_subject_announcements_updated_at
  before update on public.subject_announcements
  for each row
  execute function public.set_subject_announcements_updated_at();

comment on table public.subject_events is
  'Teacher-managed upcoming subject events such as exams, deadlines and official reminders.';

comment on table public.subject_announcements is
  'Single active plain-text announcement per subject for learner-facing communication.';

notify pgrst, 'reload schema';
