-- BUSINESS STUDIES CALCULATION QUESTION TYPE: activity_questions.answer_text
-- (the existing, previously-unused confidential model-answer/marking-key
-- column) is now populated by the create route's plain insert for brand
-- new activities. update_activity_material_version() is the OTHER write
-- path -- used when an existing activity is edited and its material
-- changed (new/edited/reordered questions, retitled activity, etc) -- and
-- its jsonb_to_recordset() call used an explicit column list that did not
-- include answer_text, so any marking key generated for a Calculation
-- question would have silently been dropped (left null) the moment a
-- teacher edited that activity. This reissues the function with
-- answer_text added to the recordset, insert and on-conflict-update
-- clauses so it survives edits exactly like every other question field.
create or replace function public.update_activity_material_version(
  p_activity_id uuid,
  p_title text,
  p_instructions text,
  p_total_marks integer,
  p_lesson_material_id uuid,
  p_due_date date,
  p_questions jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_version integer;
  next_version integer;
  submitted_question_ids uuid[];
begin
  select activity.version
  into current_version
  from public.activities as activity
  where activity.id = p_activity_id
  for update;

  if current_version is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACTIVITY_NOT_FOUND';
  end if;

  if coalesce(jsonb_typeof(p_questions), '') <> 'array'
    or jsonb_array_length(p_questions) = 0
  then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_QUESTIONS';
  end if;

  select array_agg(question.id)
  into submitted_question_ids
  from jsonb_to_recordset(p_questions) as question(id uuid);

  if exists (
    select 1
    from public.activity_questions as existing_question
    where existing_question.id = any(submitted_question_ids)
      and existing_question.activity_id <> p_activity_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_QUESTION_IDS';
  end if;

  insert into public.activity_questions (
    id,
    activity_id,
    question_number,
    paper,
    question_type,
    question_text,
    marks,
    assessment_objective,
    guidance,
    answer_text,
    display_order
  )
  select
    question.id,
    p_activity_id,
    question.question_number,
    question.paper,
    question.question_type,
    question.question_text,
    question.marks,
    question.assessment_objective,
    question.guidance,
    question.answer_text,
    question.display_order
  from jsonb_to_recordset(p_questions) as question(
    id uuid,
    question_number integer,
    paper text,
    question_type text,
    question_text text,
    marks integer,
    assessment_objective text,
    guidance text,
    answer_text text,
    display_order integer
  )
  on conflict (id) do update
  set
    question_number = excluded.question_number,
    paper = excluded.paper,
    question_type = excluded.question_type,
    question_text = excluded.question_text,
    marks = excluded.marks,
    assessment_objective = excluded.assessment_objective,
    guidance = excluded.guidance,
    answer_text = excluded.answer_text,
    display_order = excluded.display_order;

  delete from public.activity_questions
  where activity_id = p_activity_id
    and not (id = any(submitted_question_ids));

  next_version := current_version + 1;

  update public.activities
  set
    title = p_title,
    instructions = p_instructions,
    total_marks = p_total_marks,
    lesson_material_id = p_lesson_material_id,
    due_date = p_due_date,
    version = next_version
  where id = p_activity_id;

  return next_version;
end;
$$;
