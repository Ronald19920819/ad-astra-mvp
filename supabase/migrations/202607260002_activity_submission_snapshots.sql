alter table public.activities
  add column if not exists version integer not null default 1
    check (version > 0);

alter table public.activity_submissions
  add column if not exists activity_snapshot jsonb null,
  add column if not exists submitted_activity_version integer null
    check (submitted_activity_version > 0),
  add column if not exists original_total_marks integer null
    check (original_total_marks > 0),
  add column if not exists snapshot_created_at timestamptz null;

alter table public.activity_submission_answers
  drop constraint if exists activity_submission_answers_question_id_fkey;

comment on column public.activity_submission_answers.question_id is
  'Stable question UUID recorded in the immutable submission snapshot. It intentionally does not reference the editable live activity_questions table.';

with snapshot_sources as (
  select
    submission.id as submission_id,
    jsonb_build_object(
      'schemaVersion', 1,
      'legacyBackfill', true,
      'submittedAt', submission.submitted_at,
      'activity', jsonb_build_object(
        'id', activity.id,
        'version', activity.version,
        'title', activity.title,
        'instructions', activity.instructions,
        'totalMarks', activity.total_marks,
        'dueDate', activity.due_date
      ),
      'subject', jsonb_build_object(
        'id', subject.id,
        'name', subject.name
      ),
      'lesson', jsonb_build_object(
        'id', lesson.id,
        'title', lesson.title,
        'lessonNumber', lesson.lesson_number,
        'termNumber', lesson.term_number,
        'weekNumber', lesson.week_number
      ),
      'reading', jsonb_build_object(
        'id', material.id,
        'title', material.title,
        'contentText', coalesce(material.content_text, '')
      ),
      'questions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', question.id,
              'questionNumber', question.question_number,
              'displayOrder', coalesce(
                question.display_order,
                question.question_number
              ),
              'paper', question.paper,
              'questionType', question.question_type,
              'questionText', question.question_text,
              'marks', question.marks,
              'assessmentObjective', question.assessment_objective,
              'guidance', question.guidance
            )
            order by
              coalesce(question.display_order, question.question_number),
              question.question_number
          )
          from public.activity_questions as question
          where question.activity_id = activity.id
        ),
        '[]'::jsonb
      )
    ) as snapshot,
    activity.version,
    activity.total_marks
  from public.activity_submissions as submission
  join public.activities as activity
    on activity.id = submission.activity_id
  join public.lesson_materials as material
    on material.id = activity.lesson_material_id
  join public.lessons as lesson
    on lesson.id = material.lesson_id
  join public.subjects as subject
    on subject.id = lesson.subject_id
  where submission.activity_snapshot is null
)
update public.activity_submissions as submission
set
  activity_snapshot = source.snapshot,
  submitted_activity_version = source.version,
  original_total_marks = source.total_marks,
  snapshot_created_at = now()
from snapshot_sources as source
where submission.id = source.submission_id;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_snapshot_fields_check;

alter table public.activity_submissions
  add constraint activity_submissions_snapshot_fields_check
  check (
    (
      activity_snapshot is null
      and submitted_activity_version is null
      and original_total_marks is null
      and snapshot_created_at is null
    )
    or
    (
      jsonb_typeof(activity_snapshot) = 'object'
      and submitted_activity_version is not null
      and original_total_marks is not null
      and snapshot_created_at is not null
      and activity_snapshot #>> '{activity,title}' is not null
      and (activity_snapshot #>> '{activity,version}')::integer
        = submitted_activity_version
      and (activity_snapshot #>> '{activity,totalMarks}')::integer
        = original_total_marks
    )
  );

create or replace function public.protect_activity_submission_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.activity_snapshot is not null and (
    new.activity_snapshot is distinct from old.activity_snapshot
    or new.submitted_activity_version
      is distinct from old.submitted_activity_version
    or new.original_total_marks is distinct from old.original_total_marks
    or new.snapshot_created_at is distinct from old.snapshot_created_at
  ) then
    raise exception 'Activity submission snapshots are immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_activity_submission_snapshot
  on public.activity_submissions;

create trigger protect_activity_submission_snapshot
  before update of
    activity_snapshot,
    submitted_activity_version,
    original_total_marks,
    snapshot_created_at
  on public.activity_submissions
  for each row
  execute function public.protect_activity_submission_snapshot();

create or replace function public.create_activity_submission_snapshot(
  p_activity_id uuid,
  p_learner_id uuid,
  p_expected_version integer,
  p_snapshot jsonb,
  p_original_total_marks integer,
  p_answers jsonb,
  p_submitted_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_version integer;
  current_total integer;
  current_title text;
  new_submission_id uuid;
begin
  select activity.version, activity.total_marks, activity.title
  into current_version, current_total, current_title
  from public.activities as activity
  where activity.id = p_activity_id
  for share;

  if current_version is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACTIVITY_NOT_FOUND';
  end if;

  if current_version <> p_expected_version then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVITY_VERSION_CHANGED';
  end if;

  if current_total <> p_original_total_marks
    or coalesce(p_snapshot #>> '{activity,id}', '') <> p_activity_id::text
    or coalesce(p_snapshot #>> '{activity,title}', '') <> current_title
    or coalesce(
      (p_snapshot #>> '{activity,version}')::integer,
      -1
    ) <> current_version
    or coalesce(
      (p_snapshot #>> '{activity,totalMarks}')::integer,
      -1
    ) <> current_total
    or coalesce(jsonb_typeof(p_snapshot -> 'questions'), '') <> 'array'
    or coalesce(jsonb_typeof(p_answers), '') <> 'array'
    or jsonb_array_length(p_answers) = 0
    or jsonb_array_length(p_answers)
      <> jsonb_array_length(p_snapshot -> 'questions')
  then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_SNAPSHOT';
  end if;

  if (
    select coalesce(sum(snapshot_question.marks), 0)
    from jsonb_to_recordset(p_snapshot -> 'questions')
      as snapshot_question(marks integer)
  ) <> current_total
  then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_SNAPSHOT_TOTAL';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_answers) as answer(
      question_id uuid,
      answer_text text
    )
    left join jsonb_to_recordset(p_snapshot -> 'questions')
      as snapshot_question(id uuid)
      on snapshot_question.id = answer.question_id
    where snapshot_question.id is null
      or nullif(trim(answer.answer_text), '') is null
  ) or (
    select count(*)
    from (
      select answer.question_id
      from jsonb_to_recordset(p_answers) as answer(question_id uuid)
      group by answer.question_id
    ) as distinct_answers
  ) <> jsonb_array_length(p_answers)
  then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_ANSWERS';
  end if;

  insert into public.activity_submissions (
    activity_id,
    learner_id,
    status,
    submitted_at,
    activity_snapshot,
    submitted_activity_version,
    original_total_marks,
    snapshot_created_at,
    updated_at
  )
  values (
    p_activity_id,
    p_learner_id,
    'submitted',
    p_submitted_at,
    p_snapshot,
    current_version,
    current_total,
    now(),
    p_submitted_at
  )
  returning id into new_submission_id;

  insert into public.activity_submission_answers (
    submission_id,
    question_id,
    answer_text,
    updated_at
  )
  select
    new_submission_id,
    answer.question_id,
    trim(answer.answer_text),
    p_submitted_at
  from jsonb_to_recordset(p_answers) as answer(
    question_id uuid,
    answer_text text
  );

  if not found then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_ANSWERS';
  end if;

  return new_submission_id;
end;
$$;

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

revoke all on function public.create_activity_submission_snapshot(
  uuid,
  uuid,
  integer,
  jsonb,
  integer,
  jsonb,
  timestamptz
) from public, anon, authenticated;

revoke all on function public.update_activity_material_version(
  uuid,
  text,
  text,
  integer,
  uuid,
  date,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_activity_submission_snapshot(
  uuid,
  uuid,
  integer,
  jsonb,
  integer,
  jsonb,
  timestamptz
) to service_role;

grant execute on function public.update_activity_material_version(
  uuid,
  text,
  text,
  integer,
  uuid,
  date,
  jsonb
) to service_role;

comment on column public.activities.version is
  'Learner-facing material revision. It increments only after a successful material activity edit.';
comment on column public.activity_submissions.activity_snapshot is
  'Immutable learner-visible activity evidence captured at final submission.';
comment on column public.activity_submissions.original_total_marks is
  'The possible mark total for the exact submitted activity version.';
comment on column public.activity_submissions.submitted_activity_version is
  'The live activity material version captured at final submission.';

notify pgrst, 'reload schema';
