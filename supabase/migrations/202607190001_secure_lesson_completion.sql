create table if not exists public.learner_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  quiz_score integer not null check (quiz_score >= 0),
  quiz_total integer not null check (quiz_total > 0),
  passed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  check (quiz_score <= quiz_total),
  check (passed = (quiz_score = quiz_total))
);

create index if not exists learner_quiz_attempts_learner_lesson_idx
  on public.learner_quiz_attempts (learner_id, lesson_id);

create table if not exists public.learner_lesson_completions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  quiz_score integer not null check (quiz_score > 0),
  unique (learner_id, lesson_id)
);

alter table public.learner_quiz_attempts enable row level security;
alter table public.learner_lesson_completions enable row level security;

create policy "Learners can read their own quiz attempts"
  on public.learner_quiz_attempts
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learners can read their own lesson completions"
  on public.learner_lesson_completions
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);
