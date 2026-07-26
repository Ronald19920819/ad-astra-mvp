create table if not exists public.subject_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null check (
    length(btrim(title)) > 0
    and length(title) <= 200
  ),
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subject_topics_subject_title_normalized_uidx
  on public.subject_topics (subject_id, lower(btrim(title)));

create unique index if not exists subject_topics_id_subject_id_uidx
  on public.subject_topics (id, subject_id);

create index if not exists subject_topics_subject_id_idx
  on public.subject_topics (subject_id);

alter table public.subject_topics enable row level security;

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
  );
$$;

revoke all on function public.can_read_subject_topics(uuid) from public;
revoke all on function public.can_manage_subject_topics(uuid) from public;
grant execute on function public.can_read_subject_topics(uuid) to authenticated;
grant execute on function public.can_manage_subject_topics(uuid) to authenticated;

create policy "Authorised subject members can read topics"
  on public.subject_topics
  for select
  to authenticated
  using (public.can_read_subject_topics(subject_id));

create policy "Authorised teachers can create topics"
  on public.subject_topics
  for insert
  to authenticated
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can update topics"
  on public.subject_topics
  for update
  to authenticated
  using (public.can_manage_subject_topics(subject_id))
  with check (public.can_manage_subject_topics(subject_id));

create policy "Authorised teachers can delete topics"
  on public.subject_topics
  for delete
  to authenticated
  using (public.can_manage_subject_topics(subject_id));

revoke all on table public.subject_topics from anon;
grant select, insert, update, delete
  on table public.subject_topics
  to authenticated;

create or replace function public.set_subject_topics_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subject_topics_updated_at
  on public.subject_topics;

create trigger set_subject_topics_updated_at
  before update on public.subject_topics
  for each row
  execute function public.set_subject_topics_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.lessons'::regclass
      and attname = 'subject_id'
      and atttypid = 'uuid'::regtype
      and not attisdropped
  ) then
    raise exception
      'public.lessons.subject_id must exist and use the uuid type';
  end if;
end
$$;

alter table public.lessons
  add column if not exists topic_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_topic_subject_fkey'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_topic_subject_fkey
      foreign key (topic_id, subject_id)
      references public.subject_topics (id, subject_id)
      on delete restrict;
  end if;
end
$$;

create index if not exists lessons_topic_id_idx
  on public.lessons (topic_id);

comment on table public.subject_topics is
  'Teacher-managed subject topics that can group multiple lessons.';

comment on column public.lessons.topic_id is
  'Optional topic assigned to a lesson. Null preserves existing ungrouped lessons.';

notify pgrst, 'reload schema';
