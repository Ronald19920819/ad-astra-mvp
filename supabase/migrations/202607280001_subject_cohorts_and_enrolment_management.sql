alter table public.subjects
  add column if not exists code text;

create unique index if not exists subjects_code_uidx
  on public.subjects (code)
  where code is not null;

comment on column public.subjects.code is
  'Stable internal AD Astra subject code used for cohort-safe routing and enrolment management.';

update public.subjects
set
  name = 'Business Studies 0450 - IGCSE 2',
  slug = 'business-studies-0450-igcse-2',
  code = 'BS0450-IG2'
where id = 'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid;

update public.subjects
set
  name = 'History 0470 - IGCSE 2',
  slug = 'history-0470-igcse-2',
  code = 'HIS0470-IG2'
where id = 'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid;

update public.subjects
set
  name = 'English 0861 - Stage 9',
  slug = 'english-0861-stage-9',
  code = 'ENG0861-S9'
where id = '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid;

update public.subjects
set
  name = 'Afrikaans - Stage 9',
  slug = 'afrikaans-stage-9',
  code = 'AFR-S9'
where id = 'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid;

do $$
declare
  source_subject public.subjects%rowtype;
begin
  if not exists (
    select 1
    from public.subjects
    where id = '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid
  ) then
    select *
    into source_subject
    from public.subjects
    where id = 'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid;

    if source_subject.id is null then
      raise exception 'Source subject Business Studies 0450 - IGCSE 2 not found.';
    end if;

    source_subject.id := '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid;
    source_subject.name := 'Business Studies 0450 - IGCSE 1';
    source_subject.slug := 'business-studies-0450-igcse-1';
    source_subject.code := 'BS0450-IG1';

    insert into public.subjects
    select (source_subject).*;
  end if;
end
$$;

do $$
declare
  source_subject public.subjects%rowtype;
begin
  if not exists (
    select 1
    from public.subjects
    where id = '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid
  ) then
    select *
    into source_subject
    from public.subjects
    where id = 'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid;

    if source_subject.id is null then
      raise exception 'Source subject History 0470 - IGCSE 2 not found.';
    end if;

    source_subject.id := '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid;
    source_subject.name := 'History 0470 - IGCSE 1';
    source_subject.slug := 'history-0470-igcse-1';
    source_subject.code := 'HIS0470-IG1';

    insert into public.subjects
    select (source_subject).*;
  end if;
end
$$;

do $$
declare
  source_subject public.subjects%rowtype;
begin
  if not exists (
    select 1
    from public.subjects
    where id = '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid
  ) then
    select *
    into source_subject
    from public.subjects
    where id = '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid;

    if source_subject.id is null then
      raise exception 'Source subject English 0861 - Stage 9 not found.';
    end if;

    source_subject.id := '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid;
    source_subject.name := 'English 0861 - Stage 8';
    source_subject.slug := 'english-0861-stage-8';
    source_subject.code := 'ENG0861-S8';

    insert into public.subjects
    select (source_subject).*;
  end if;
end
$$;

do $$
declare
  source_subject public.subjects%rowtype;
begin
  if not exists (
    select 1
    from public.subjects
    where id = 'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
  ) then
    select *
    into source_subject
    from public.subjects
    where id = 'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid;

    if source_subject.id is null then
      raise exception 'Source subject Afrikaans - Stage 9 not found.';
    end if;

    source_subject.id := 'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid;
    source_subject.name := 'Afrikaans - Stage 8';
    source_subject.slug := 'afrikaans-stage-8';
    source_subject.code := 'AFR-S8';

    insert into public.subjects
    select (source_subject).*;
  end if;
end
$$;

insert into public.teacher_subjects (
  teacher_profile_id,
  subject_id,
  status
)
select
  teacher_subjects.teacher_profile_id,
  mapped_subjects.new_subject_id,
  coalesce(teacher_subjects.status, 'active')
from public.teacher_subjects
join (
  values
    (
      'c472f3c9-0e6f-40de-a748-3ad9400ac069'::uuid,
      '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid
    ),
    (
      'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid,
      '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid
    ),
    (
      '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
      '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid
    ),
    (
      'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
      'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
    )
) as mapped_subjects (existing_subject_id, new_subject_id)
  on mapped_subjects.existing_subject_id = teacher_subjects.subject_id
where not exists (
  select 1
  from public.teacher_subjects as existing_assignment
  where existing_assignment.teacher_profile_id = teacher_subjects.teacher_profile_id
    and existing_assignment.subject_id = mapped_subjects.new_subject_id
);

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
      '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid,
      'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid,
      '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid,
      '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
      '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid,
      'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
      'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
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
    '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid,
    'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid,
    '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid,
    '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
    '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid,
    'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
    'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
  ]);

  if required_subject_count <> 8 then
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
      '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid,
      'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid,
      '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid,
      '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
      '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid,
      'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
      'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
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
    '7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11'::uuid,
    'dca2600c-932f-46bf-904c-a99be158e7f0'::uuid,
    '8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22'::uuid,
    '0d0f5c7f-23c6-4022-a5c3-f6e1c779b681'::uuid,
    '9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33'::uuid,
    'e26c1112-3627-4a56-8f6a-4eab5d209b23'::uuid,
    'a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044'::uuid
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

notify pgrst, 'reload schema';
