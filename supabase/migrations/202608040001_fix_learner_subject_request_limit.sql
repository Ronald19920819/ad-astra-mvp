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
  if p_subject_ids is null or cardinality(p_subject_ids) = 0 then
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
      errcode = '22023',
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

grant execute on function public.request_own_learner_subjects(uuid[])
  to authenticated;
