alter table public.profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.teacher_subjects enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.teacher_profiles from anon;
revoke all on table public.teacher_subjects from anon;

revoke insert, update, delete on table public.profiles from authenticated;
revoke insert, update, delete on table public.teacher_profiles from authenticated;
revoke insert, update, delete on table public.teacher_subjects from authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.teacher_profiles to authenticated;
grant select on table public.teacher_subjects to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Authenticated users can read their own profile'
  ) then
    create policy "Authenticated users can read their own profile"
      on public.profiles
      for select
      to authenticated
      using (auth_user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_profiles'
      and policyname = 'Teachers can read their own teacher profile'
  ) then
    create policy "Teachers can read their own teacher profile"
      on public.teacher_profiles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = teacher_profiles.profile_id
            and profiles.auth_user_id = (select auth.uid())
            and profiles.role = 'teacher'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_subjects'
      and policyname = 'Teachers can read their own subject assignments'
  ) then
    create policy "Teachers can read their own subject assignments"
      on public.teacher_subjects
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.teacher_profiles
          join public.profiles
            on profiles.id = teacher_profiles.profile_id
          where teacher_profiles.id = teacher_subjects.teacher_profile_id
            and profiles.auth_user_id = (select auth.uid())
            and profiles.role = 'teacher'
            and teacher_profiles.status = 'active'
        )
      );
  end if;
end
$$;

create or replace function public.enforce_single_administrator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_administrator is true then
    perform pg_advisory_xact_lock(83478372001);

    if exists (
      select 1
      from public.teacher_profiles as existing
      where existing.is_administrator is true
        and existing.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'AD_ASTRA_ADMINISTRATOR_ALREADY_EXISTS';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_administrator
  on public.teacher_profiles;

create trigger enforce_single_administrator
  before insert or update of is_administrator
  on public.teacher_profiles
  for each row
  execute function public.enforce_single_administrator();

create or replace function public.bootstrap_primary_administrator(
  p_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile_id uuid;
  target_teacher_profile_id uuid;
  required_subject_count integer;
begin
  perform pg_advisory_xact_lock(83478372001);

  if not exists (
    select 1
    from auth.users
    where id = p_auth_user_id
      and email_confirmed_at is not null
  ) then
    raise exception using
      errcode = '22023',
      message = 'VERIFIED_AUTH_USER_REQUIRED';
  end if;

  if exists (
    select 1
    from public.teacher_profiles
    join public.profiles
      on profiles.id = teacher_profiles.profile_id
    where teacher_profiles.is_administrator is true
      and profiles.auth_user_id <> p_auth_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'AD_ASTRA_ADMINISTRATOR_ALREADY_EXISTS';
  end if;

  select count(*)
  into required_subject_count
  from public.subjects
  where id = any(array[
    'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid,
    '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
    'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
    'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid
  ]);

  if required_subject_count <> 4 then
    raise exception using
      errcode = 'P0002',
      message = 'REQUIRED_SUBJECTS_NOT_FOUND';
  end if;

  select id
  into target_profile_id
  from public.profiles
  where auth_user_id = p_auth_user_id
  for update;

  if target_profile_id is null then
    insert into public.profiles (
      auth_user_id,
      first_name,
      surname,
      full_name,
      role
    )
    values (
      p_auth_user_id,
      'Ronald',
      'Petersen',
      'Ronald Petersen',
      'teacher'
    )
    returning id into target_profile_id;
  else
    update public.profiles
    set
      first_name = 'Ronald',
      surname = 'Petersen',
      full_name = 'Ronald Petersen',
      role = 'teacher'
    where id = target_profile_id;
  end if;

  select id
  into target_teacher_profile_id
  from public.teacher_profiles
  where profile_id = target_profile_id
  for update;

  if target_teacher_profile_id is null then
    insert into public.teacher_profiles (
      profile_id,
      faculty_name,
      is_administrator,
      status
    )
    values (
      target_profile_id,
      'AD Astra Faculty',
      true,
      'active'
    )
    returning id into target_teacher_profile_id;
  else
    update public.teacher_profiles
    set
      is_administrator = true,
      status = 'active'
    where id = target_teacher_profile_id;
  end if;

  update public.teacher_subjects
  set status = 'active'
  where teacher_profile_id = target_teacher_profile_id
    and subject_id = any(array[
      'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid,
      '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
      'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
      'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid
    ]);

  insert into public.teacher_subjects (
    teacher_profile_id,
    subject_id,
    status
  )
  select
    target_teacher_profile_id,
    required_subject_id,
    'active'
  from unnest(array[
    'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid,
    '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
    'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
    'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid
  ]) as required_subject_id
  where not exists (
    select 1
    from public.teacher_subjects
    where teacher_subjects.teacher_profile_id = target_teacher_profile_id
      and teacher_subjects.subject_id = required_subject_id
  );

  return target_teacher_profile_id;
end;
$$;

revoke all on function public.bootstrap_primary_administrator(uuid)
  from public, anon, authenticated;
grant execute on function public.bootstrap_primary_administrator(uuid)
  to service_role;

comment on function public.bootstrap_primary_administrator(uuid) is
  'Service-role-only, idempotent bootstrap for the first verified AD Astra Teacher and Administrator account.';
comment on function public.enforce_single_administrator() is
  'Prevents a second administrator until an explicit administrator-management phase replaces this MVP rule.';

notify pgrst, 'reload schema';
