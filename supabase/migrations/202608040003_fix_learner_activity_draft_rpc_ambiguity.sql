create or replace function public.save_learner_activity_draft(
  p_activity_id uuid,
  p_learner_id uuid,
  p_subject_id uuid,
  p_activity_version integer,
  p_expected_revision integer,
  p_answers jsonb
)
returns table (
  draft_id uuid,
  revision integer,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_draft public.learner_activity_drafts%rowtype;
  next_revision integer;
  answer_count integer;
begin
  if p_activity_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_VERSION';
  end if;

  if p_expected_revision < 0 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_DRAFT_REVISION';
  end if;

  if coalesce(jsonb_typeof(p_answers), '') <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'INVALID_DRAFT_ANSWERS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_answers) as answer(
      question_id uuid,
      answer_text text
    )
    where answer.question_id is null
  ) or (
    select count(*)
    from (
      select answer.question_id
      from jsonb_to_recordset(p_answers) as answer(question_id uuid)
      group by answer.question_id
    ) as distinct_answers
  ) <> jsonb_array_length(p_answers) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_DRAFT_ANSWERS';
  end if;

  select *
  into existing_draft
  from public.learner_activity_drafts as draft_row
  where draft_row.learner_id = p_learner_id
    and draft_row.activity_id = p_activity_id
  for update;

  if existing_draft.id is null then
    if p_expected_revision <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'DRAFT_REVISION_CONFLICT';
    end if;

    insert into public.learner_activity_drafts as draft_row (
      activity_id,
      learner_id,
      subject_id,
      activity_version,
      revision
    )
    values (
      p_activity_id,
      p_learner_id,
      p_subject_id,
      p_activity_version,
      1
    )
    returning draft_row.* into existing_draft;

    next_revision := 1;
  else
    if existing_draft.revision <> p_expected_revision then
      raise exception using
        errcode = 'P0001',
        message = 'DRAFT_REVISION_CONFLICT';
    end if;

    next_revision := existing_draft.revision + 1;

    update public.learner_activity_drafts as draft_row
    set
      subject_id = p_subject_id,
      activity_version = p_activity_version,
      revision = next_revision,
      updated_at = now()
    where draft_row.id = existing_draft.id
    returning draft_row.* into existing_draft;

  end if;

  delete from public.learner_activity_draft_answers as draft_answer
  where draft_answer.draft_id = existing_draft.id;

  insert into public.learner_activity_draft_answers as draft_answer (
    draft_id,
    question_id,
    answer_text
  )
  select
    existing_draft.id,
    answer.question_id,
    answer.answer_text
  from jsonb_to_recordset(p_answers) as answer(
    question_id uuid,
    answer_text text
  )
  where answer.question_id is not null;

  get diagnostics answer_count = row_count;

  draft_id := existing_draft.id;
  revision := next_revision;
  updated_at := existing_draft.updated_at;

  if answer_count = 0 then
    updated_at := existing_draft.updated_at;
  end if;

  return next;
end;
$$;

revoke all on function public.save_learner_activity_draft(
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  jsonb
) from public, anon, authenticated;

grant execute on function public.save_learner_activity_draft(
  uuid,
  uuid,
  uuid,
  integer,
  integer,
  jsonb
) to service_role;

notify pgrst, 'reload schema';
