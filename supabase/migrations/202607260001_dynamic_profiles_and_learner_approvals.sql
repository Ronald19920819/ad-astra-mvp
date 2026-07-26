alter table public.profiles
  add column if not exists first_name text null,
  add column if not exists surname text null,
  add column if not exists profile_image_url text null;

alter table public.learner_profiles
  add column if not exists school_name text null;

alter table public.teacher_profiles
  add column if not exists school_name text null,
  add column if not exists is_administrator boolean not null default false;

alter table public.teacher_subjects
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_subjects_status_check'
      and conrelid = 'public.teacher_subjects'::regclass
  ) then
    alter table public.teacher_subjects
      add constraint teacher_subjects_status_check
      check (status in ('active', 'inactive'));
  end if;
end
$$;

alter table public.learner_subjects
  add column if not exists status text not null default 'approved',
  add column if not exists requested_at timestamptz null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by uuid null
    references public.teacher_profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by uuid null
    references public.teacher_profiles(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.learner_subjects
set
  requested_at = coalesce(requested_at, created_at),
  approved_at = case
    when status = 'approved' then coalesce(approved_at, created_at)
    else approved_at
  end
where requested_at is null
   or (status = 'approved' and approved_at is null);

alter table public.learner_subjects
  alter column requested_at set default now(),
  alter column requested_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'learner_subjects_status_check'
      and conrelid = 'public.learner_subjects'::regclass
  ) then
    alter table public.learner_subjects
      add constraint learner_subjects_status_check
      check (status in ('pending', 'approved', 'declined'));
  end if;
end
$$;

create unique index if not exists learner_subjects_learner_subject_uidx
  on public.learner_subjects (learner_profile_id, subject_id);

create index if not exists learner_subjects_pending_subject_idx
  on public.learner_subjects (subject_id, requested_at)
  where status = 'pending';

create index if not exists learner_subjects_active_learner_idx
  on public.learner_subjects (learner_profile_id, subject_id)
  where status = 'approved' and is_active = true;

create index if not exists teacher_subjects_active_teacher_idx
  on public.teacher_subjects (teacher_profile_id, subject_id)
  where status = 'active';

create or replace function public.set_learner_subjects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_learner_subjects_updated_at
  on public.learner_subjects;

create trigger set_learner_subjects_updated_at
  before update on public.learner_subjects
  for each row
  execute function public.set_learner_subjects_updated_at();

alter table public.learner_subjects enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learner_subjects'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy %I on public.learner_subjects',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy "Learners can read their own subject requests"
  on public.learner_subjects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.learner_profiles
        on learner_profiles.profile_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'learner'
        and learner_profiles.id = learner_subjects.learner_profile_id
    )
  );

create policy "Teachers can read requests for assigned subjects"
  on public.learner_subjects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.teacher_profiles
        on teacher_profiles.profile_id = profiles.id
      join public.teacher_subjects
        on teacher_subjects.teacher_profile_id = teacher_profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'teacher'
        and teacher_profiles.status = 'active'
        and teacher_subjects.status = 'active'
        and teacher_subjects.subject_id = learner_subjects.subject_id
    )
  );

revoke all on table public.learner_subjects from anon;
revoke insert, update, delete on table public.learner_subjects
  from authenticated;
grant select on table public.learner_subjects to authenticated;

create or replace function public.can_read_subject_topics(
  requested_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.profiles
      join public.learner_profiles
        on learner_profiles.profile_id = profiles.id
      join public.learner_subjects
        on learner_subjects.learner_profile_id = learner_profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'learner'
        and learner_profiles.status = 'active'
        and learner_subjects.subject_id = requested_subject_id
        and learner_subjects.status = 'approved'
        and learner_subjects.is_active = true
    )
    or
    exists (
      select 1
      from public.profiles
      join public.teacher_profiles
        on teacher_profiles.profile_id = profiles.id
      join public.teacher_subjects
        on teacher_subjects.teacher_profile_id = teacher_profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'teacher'
        and teacher_profiles.status = 'active'
        and teacher_subjects.subject_id = requested_subject_id
        and teacher_subjects.status = 'active'
    );
$$;

create or replace function public.can_manage_subject_topics(
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
    from public.profiles
    join public.teacher_profiles
      on teacher_profiles.profile_id = profiles.id
    join public.teacher_subjects
      on teacher_subjects.teacher_profile_id = teacher_profiles.id
    where profiles.auth_user_id = (select auth.uid())
      and profiles.role = 'teacher'
      and teacher_profiles.status = 'active'
      and teacher_subjects.subject_id = requested_subject_id
      and teacher_subjects.status = 'active'
  );
$$;

revoke all on function public.can_read_subject_topics(uuid) from public;
revoke all on function public.can_manage_subject_topics(uuid) from public;
grant execute on function public.can_read_subject_topics(uuid) to authenticated;
grant execute on function public.can_manage_subject_topics(uuid) to authenticated;

comment on column public.profiles.first_name is
  'Optional authenticated profile first name for onboarding and display.';
comment on column public.profiles.surname is
  'Optional authenticated profile surname for onboarding and display.';
comment on column public.profiles.profile_image_url is
  'Optional profile image URL. Initials remain the UI fallback.';
comment on column public.learner_profiles.school_name is
  'Optional learner school name for the MVP before a multi-school model.';
comment on column public.teacher_profiles.school_name is
  'Optional teacher school name for the MVP before a multi-school model.';
comment on column public.teacher_profiles.is_administrator is
  'Explicit server-verified administrator flag. False by default.';
comment on column public.learner_subjects.status is
  'Subject request state: pending, approved, or declined.';
comment on column public.learner_subjects.is_active is
  'Whether an approved enrolment currently grants subject access.';

notify pgrst, 'reload schema';
