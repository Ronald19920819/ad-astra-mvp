create or replace function public.create_learner_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_first_name text;
  supplied_surname text;
  supplied_full_name text;
begin
  supplied_first_name := left(
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    100
  );
  supplied_surname := left(
    trim(coalesce(new.raw_user_meta_data ->> 'surname', '')),
    100
  );
  supplied_full_name := trim(
    concat_ws(' ', supplied_first_name, supplied_surname)
  );

  if supplied_full_name = '' then
    supplied_full_name := split_part(coalesce(new.email, 'Learner'), '@', 1);
  end if;

  insert into public.profiles (
    auth_user_id,
    first_name,
    surname,
    full_name,
    role
  )
  values (
    new.id,
    nullif(supplied_first_name, ''),
    nullif(supplied_surname, ''),
    supplied_full_name,
    'learner'
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_learner_profile_after_auth_signup
  on auth.users;

create trigger create_learner_profile_after_auth_signup
  after insert on auth.users
  for each row
  execute function public.create_learner_profile_for_auth_user();

revoke all on function public.create_learner_profile_for_auth_user()
  from public, anon, authenticated;

alter table public.learner_profiles enable row level security;

revoke all on table public.learner_profiles from anon;
revoke insert, update, delete on table public.learner_profiles
  from authenticated;
grant select on table public.learner_profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learner_profiles'
      and policyname = 'Learners can read their own learner profile'
  ) then
    create policy "Learners can read their own learner profile"
      on public.learner_profiles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = learner_profiles.profile_id
            and profiles.auth_user_id = (select auth.uid())
            and profiles.role = 'learner'
        )
      );
  end if;
end
$$;

create or replace function public.complete_own_learner_profile(
  p_school_name text,
  p_grade text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_profile_id uuid;
  completed_learner_profile_id uuid;
  clean_school_name text;
  clean_grade text;
begin
  clean_school_name := trim(coalesce(p_school_name, ''));
  clean_grade := trim(coalesce(p_grade, ''));

  if length(clean_school_name) < 2
    or length(clean_school_name) > 160
    or length(clean_grade) < 1
    or length(clean_grade) > 100
  then
    raise exception using
      errcode = '22023',
      message = 'INVALID_LEARNER_PROFILE';
  end if;

  select profiles.id
  into authenticated_profile_id
  from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.role = 'learner'
  for update;

  if authenticated_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'LEARNER_PROFILE_REQUIRED';
  end if;

  select learner_profiles.id
  into completed_learner_profile_id
  from public.learner_profiles
  where learner_profiles.profile_id = authenticated_profile_id
  for update;

  if completed_learner_profile_id is null then
    insert into public.learner_profiles (
      profile_id,
      school_name,
      grade,
      status
    )
    values (
      authenticated_profile_id,
      clean_school_name,
      clean_grade,
      'active'
    )
    returning id into completed_learner_profile_id;
  else
    update public.learner_profiles
    set
      school_name = clean_school_name,
      grade = clean_grade,
      status = 'active'
    where id = completed_learner_profile_id;
  end if;

  return completed_learner_profile_id;
end;
$$;

create or replace function public.request_own_learner_subjects(
  p_subject_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_learner_profile_id uuid;
  requested_subject_count integer;
begin
  if p_subject_ids is null
    or cardinality(p_subject_ids) = 0
    or cardinality(p_subject_ids) > 4
  then
    raise exception using
      errcode = '22023',
      message = 'SELECT_AT_LEAST_ONE_SUBJECT';
  end if;

  if (
    select count(distinct requested_subject_id)
    from unnest(p_subject_ids) as requested_subject_id
    where requested_subject_id = any(array[
      'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid,
      '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
      'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
      'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid
    ])
  ) <> (
    select count(distinct requested_subject_id)
    from unnest(p_subject_ids) as requested_subject_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_SUBJECT_REQUEST';
  end if;

  select learner_profiles.id
  into authenticated_learner_profile_id
  from public.profiles
  join public.learner_profiles
    on learner_profiles.profile_id = profiles.id
  where profiles.auth_user_id = (select auth.uid())
    and profiles.role = 'learner'
    and learner_profiles.status = 'active'
  for update of learner_profiles;

  if authenticated_learner_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'COMPLETE_LEARNER_PROFILE_FIRST';
  end if;

  insert into public.learner_subjects (
    learner_profile_id,
    subject_id,
    status,
    requested_at,
    approved_at,
    approved_by,
    reviewed_at,
    reviewed_by,
    is_active
  )
  select
    authenticated_learner_profile_id,
    requested_subject_id,
    'pending',
    now(),
    null,
    null,
    null,
    null,
    false
  from (
    select distinct unnest(p_subject_ids) as requested_subject_id
  ) as requested
  on conflict (learner_profile_id, subject_id) do update
  set
    status = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then 'approved'
      else 'pending'
    end,
    requested_at = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then learner_subjects.requested_at
      else now()
    end,
    approved_at = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then learner_subjects.approved_at
      else null
    end,
    approved_by = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then learner_subjects.approved_by
      else null
    end,
    reviewed_at = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then learner_subjects.reviewed_at
      else null
    end,
    reviewed_by = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then learner_subjects.reviewed_by
      else null
    end,
    is_active = case
      when learner_subjects.status = 'approved'
        and learner_subjects.is_active is true
      then true
      else false
    end;

  get diagnostics requested_subject_count = row_count;
  return requested_subject_count;
end;
$$;

create or replace function public.deregister_own_learner_subject(
  p_subject_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_learner_profile_id uuid;
begin
  select learner_profiles.id
  into authenticated_learner_profile_id
  from public.profiles
  join public.learner_profiles
    on learner_profiles.profile_id = profiles.id
  where profiles.auth_user_id = (select auth.uid())
    and profiles.role = 'learner'
    and learner_profiles.status = 'active';

  if authenticated_learner_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'LEARNER_PROFILE_REQUIRED';
  end if;

  update public.learner_subjects
  set is_active = false
  where learner_profile_id = authenticated_learner_profile_id
    and subject_id = p_subject_id
    and status = 'approved'
    and is_active is true;

  return found;
end;
$$;

revoke all on function public.complete_own_learner_profile(text, text)
  from public, anon;
revoke all on function public.request_own_learner_subjects(uuid[])
  from public, anon;
revoke all on function public.deregister_own_learner_subject(uuid)
  from public, anon;

grant execute on function public.complete_own_learner_profile(text, text)
  to authenticated;
grant execute on function public.request_own_learner_subjects(uuid[])
  to authenticated;
grant execute on function public.deregister_own_learner_subject(uuid)
  to authenticated;

comment on function public.complete_own_learner_profile(text, text) is
  'Completes only the authenticated learner profile. It cannot choose or change a role.';
comment on function public.request_own_learner_subjects(uuid[]) is
  'Creates pending requests for the authenticated learner. It never grants subject access.';
comment on function public.deregister_own_learner_subject(uuid) is
  'Deactivates one approved subject for the authenticated learner without deleting history.';

notify pgrst, 'reload schema';
