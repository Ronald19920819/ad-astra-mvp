create table if not exists public.activity_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  learner_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('submitted', 'marking_failed', 'awaiting_review', 'returned')),
  submitted_at timestamptz not null default now(),
  preliminary_mark integer null check (preliminary_mark >= 0),
  preliminary_total integer null check (preliminary_total > 0),
  preliminary_percentage numeric(5, 2) null
    check (preliminary_percentage >= 0 and preliminary_percentage <= 100),
  kingdom_marked_at timestamptz null,
  final_mark integer null check (final_mark >= 0),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, activity_id),
  check (
    preliminary_mark is null or preliminary_total is null or
    preliminary_mark <= preliminary_total
  )
);

create table if not exists public.activity_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.activity_submissions(id) on delete restrict,
  question_id uuid not null
    references public.activity_questions(id) on delete restrict,
  answer_text text not null check (length(trim(answer_text)) > 0),
  kingdom_mark integer null check (kingdom_mark >= 0),
  kingdom_feedback text null,
  kingdom_judgement text null
    check (kingdom_judgement in ('correct', 'partially_correct', 'incorrect')),
  teacher_mark integer null check (teacher_mark >= 0),
  teacher_feedback text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index if not exists activity_submissions_activity_idx
  on public.activity_submissions (activity_id);

create index if not exists activity_submissions_learner_status_idx
  on public.activity_submissions (learner_id, status);

create index if not exists activity_submission_answers_submission_idx
  on public.activity_submission_answers (submission_id);

create index if not exists activity_submission_answers_question_idx
  on public.activity_submission_answers (question_id);

alter table public.activity_submissions enable row level security;
alter table public.activity_submission_answers enable row level security;

create policy "Learners can read their own activity submissions"
  on public.activity_submissions
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learners can read their own activity submission answers"
  on public.activity_submission_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.activity_submissions
      where activity_submissions.id = activity_submission_answers.submission_id
        and activity_submissions.learner_id = (select auth.uid())
    )
  );
