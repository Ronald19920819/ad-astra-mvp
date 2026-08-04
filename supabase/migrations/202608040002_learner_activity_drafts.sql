create table if not exists public.learner_activity_drafts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  activity_version integer not null check (activity_version > 0),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, activity_id)
);

create table if not exists public.learner_activity_draft_answers (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null
    references public.learner_activity_drafts(id) on delete cascade,
  question_id uuid not null,
  answer_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, question_id)
);

create index if not exists learner_activity_drafts_activity_idx
  on public.learner_activity_drafts (activity_id);

create index if not exists learner_activity_drafts_learner_subject_idx
  on public.learner_activity_drafts (learner_id, subject_id);

create index if not exists learner_activity_drafts_learner_updated_idx
  on public.learner_activity_drafts (learner_id, updated_at desc);

create index if not exists learner_activity_draft_answers_draft_idx
  on public.learner_activity_draft_answers (draft_id);

create index if not exists learner_activity_draft_answers_question_idx
  on public.learner_activity_draft_answers (question_id);

alter table public.learner_activity_drafts enable row level security;
alter table public.learner_activity_draft_answers enable row level security;

revoke all on table public.learner_activity_drafts from anon;
revoke all on table public.learner_activity_draft_answers from anon;

grant select, insert, update, delete
  on table public.learner_activity_drafts
  to authenticated;

grant select, insert, update, delete
  on table public.learner_activity_draft_answers
  to authenticated;

create policy "Learners can read their own activity drafts"
  on public.learner_activity_drafts
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learners can create their own activity drafts"
  on public.learner_activity_drafts
  for insert
  to authenticated
  with check ((select auth.uid()) = learner_id);

create policy "Learners can update their own activity drafts"
  on public.learner_activity_drafts
  for update
  to authenticated
  using ((select auth.uid()) = learner_id)
  with check ((select auth.uid()) = learner_id);

create policy "Learners can delete their own activity drafts"
  on public.learner_activity_drafts
  for delete
  to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learners can read their own activity draft answers"
  on public.learner_activity_draft_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.learner_activity_drafts
      where learner_activity_drafts.id = learner_activity_draft_answers.draft_id
        and learner_activity_drafts.learner_id = (select auth.uid())
    )
  );

create policy "Learners can create their own activity draft answers"
  on public.learner_activity_draft_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.learner_activity_drafts
      where learner_activity_drafts.id = learner_activity_draft_answers.draft_id
        and learner_activity_drafts.learner_id = (select auth.uid())
    )
  );

create policy "Learners can update their own activity draft answers"
  on public.learner_activity_draft_answers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.learner_activity_drafts
      where learner_activity_drafts.id = learner_activity_draft_answers.draft_id
        and learner_activity_drafts.learner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.learner_activity_drafts
      where learner_activity_drafts.id = learner_activity_draft_answers.draft_id
        and learner_activity_drafts.learner_id = (select auth.uid())
    )
  );

create policy "Learners can delete their own activity draft answers"
  on public.learner_activity_draft_answers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.learner_activity_drafts
      where learner_activity_drafts.id = learner_activity_draft_answers.draft_id
        and learner_activity_drafts.learner_id = (select auth.uid())
    )
  );

create or replace function public.set_learner_activity_drafts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_learner_activity_draft_answers_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_learner_activity_drafts_updated_at
  on public.learner_activity_drafts;

create trigger set_learner_activity_drafts_updated_at
  before update on public.learner_activity_drafts
  for each row
  execute function public.set_learner_activity_drafts_updated_at();

drop trigger if exists set_learner_activity_draft_answers_updated_at
  on public.learner_activity_draft_answers;

create trigger set_learner_activity_draft_answers_updated_at
  before update on public.learner_activity_draft_answers
  for each row
  execute function public.set_learner_activity_draft_answers_updated_at();

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
  from public.learner_activity_drafts
  where learner_activity_drafts.learner_id = p_learner_id
    and learner_activity_drafts.activity_id = p_activity_id
  for update;

  if existing_draft.id is null then
    if p_expected_revision <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'DRAFT_REVISION_CONFLICT';
    end if;

    insert into public.learner_activity_drafts (
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
    returning * into existing_draft;

    next_revision := 1;
  else
    if existing_draft.revision <> p_expected_revision then
      raise exception using
        errcode = 'P0001',
        message = 'DRAFT_REVISION_CONFLICT';
    end if;

    next_revision := existing_draft.revision + 1;

    update public.learner_activity_drafts
    set
      subject_id = p_subject_id,
      activity_version = p_activity_version,
      revision = next_revision,
      updated_at = now()
    where id = existing_draft.id
    returning * into existing_draft;

  end if;

  delete from public.learner_activity_draft_answers
  where draft_id = existing_draft.id;

  insert into public.learner_activity_draft_answers (
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

comment on table public.learner_activity_drafts is
  'Authoritative learner activity draft state for unfinished work.';
comment on table public.learner_activity_draft_answers is
  'Question-level learner draft answers keyed by stable activity question UUID.';
comment on column public.learner_activity_drafts.revision is
  'Authoritative server revision used for optimistic concurrency on learner activity drafts.';

notify pgrst, 'reload schema';
