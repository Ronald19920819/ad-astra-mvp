create table if not exists public.live_class_messages (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null
    references public.subjects(id) on delete cascade,
  sender_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  sender_role text not null
    check (sender_role in ('learner', 'teacher')),
  sender_display_name text not null
    check (char_length(btrim(sender_display_name)) > 0),
  message text not null
    check (
      length(btrim(message)) > 0
      and char_length(message) <= 500
    ),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by_profile_id uuid null
    references public.profiles(id) on delete restrict
);

create index if not exists live_class_messages_subject_created_at_idx
  on public.live_class_messages (subject_id, created_at desc);

create index if not exists live_class_messages_active_subject_created_at_idx
  on public.live_class_messages (subject_id, created_at desc)
  where deleted_at is null;

create or replace function public.current_live_class_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.can_read_live_class_messages_as_learner(
  requested_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learner_profiles
    join public.learner_subjects
      on learner_subjects.learner_profile_id = learner_profiles.id
    where learner_profiles.profile_id = public.current_live_class_profile_id()
      and learner_profiles.status = 'active'
      and learner_subjects.subject_id = requested_subject_id
      and learner_subjects.status = 'approved'
      and learner_subjects.is_active = true
  );
$$;

create or replace function public.can_read_live_class_messages_as_teacher(
  requested_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_profiles
    join public.teacher_subjects
      on teacher_subjects.teacher_profile_id = teacher_profiles.id
    where teacher_profiles.profile_id = public.current_live_class_profile_id()
      and teacher_profiles.status = 'active'
      and teacher_subjects.subject_id = requested_subject_id
      and teacher_subjects.status = 'active'
  );
$$;

revoke all on function public.current_live_class_profile_id() from public;
revoke all on function public.can_read_live_class_messages_as_learner(uuid) from public;
revoke all on function public.can_read_live_class_messages_as_teacher(uuid) from public;

grant execute on function public.current_live_class_profile_id() to authenticated;
grant execute on function public.can_read_live_class_messages_as_learner(uuid) to authenticated;
grant execute on function public.can_read_live_class_messages_as_teacher(uuid) to authenticated;

alter table public.live_class_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_class_messages'
      and policyname = 'Learners can read active live class messages for approved subjects'
  ) then
    create policy "Learners can read active live class messages for approved subjects"
      on public.live_class_messages
      for select
      to authenticated
      using (
        deleted_at is null
        and public.can_read_live_class_messages_as_learner(subject_id)
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_class_messages'
      and policyname = 'Teachers can read active live class messages for assigned subjects'
  ) then
    create policy "Teachers can read active live class messages for assigned subjects"
      on public.live_class_messages
      for select
      to authenticated
      using (
        deleted_at is null
        and public.can_read_live_class_messages_as_teacher(subject_id)
      );
  end if;
end
$$;

revoke all on table public.live_class_messages from anon;
revoke all on table public.live_class_messages from authenticated;
grant select on table public.live_class_messages to authenticated;
grant select, insert, update, delete on table public.live_class_messages to service_role;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_rel
    join pg_class
      on pg_class.oid = pg_publication_rel.prrelid
    join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    join pg_publication
      on pg_publication.oid = pg_publication_rel.prpubid
    where pg_publication.pubname = 'supabase_realtime'
      and pg_namespace.nspname = 'public'
      and pg_class.relname = 'live_class_messages'
  ) then
    alter publication supabase_realtime
      add table public.live_class_messages;
  end if;
end
$$;

comment on table public.live_class_messages is
  'Subject-isolated Live Classroom chat messages keyed by exact subject UUID with soft-delete audit fields preserved for moderation.';

comment on column public.live_class_messages.subject_id is
  'Exact subject UUID room identity. Sibling cohorts must never share chat messages.';

comment on column public.live_class_messages.deleted_at is
  'Soft-delete timestamp retained for teacher moderation audit. Deleted content remains in the database.';

comment on column public.live_class_messages.deleted_by_profile_id is
  'Profile that performed the moderation delete. Null means the message is still active.';

notify pgrst, 'reload schema';
