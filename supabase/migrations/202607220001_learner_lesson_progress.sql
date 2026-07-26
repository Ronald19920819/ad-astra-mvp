create table if not exists public.learner_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null references public.learner_profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  video_material_id uuid null references public.lesson_materials(id) on delete set null,
  video_started_at timestamptz null,
  video_progress_percent numeric(5, 2) not null default 0
    check (video_progress_percent >= 0 and video_progress_percent <= 100),
  video_position_seconds numeric(12, 2) not null default 0
    check (video_position_seconds >= 0),
  video_duration_seconds numeric(12, 2) null
    check (video_duration_seconds is null or video_duration_seconds > 0),
  video_updated_at timestamptz null,
  last_engaged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_profile_id, lesson_id)
);

create index if not exists learner_lesson_progress_lesson_idx
  on public.learner_lesson_progress (lesson_id);

create index if not exists learner_lesson_progress_learner_idx
  on public.learner_lesson_progress (learner_profile_id);

alter table public.learner_lesson_progress enable row level security;

create policy "Learners can read their own lesson progress"
  on public.learner_lesson_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.learner_profiles
      join public.profiles
        on profiles.id = learner_profiles.profile_id
      where learner_profiles.id = learner_lesson_progress.learner_profile_id
        and profiles.auth_user_id = (select auth.uid())
    )
  );
