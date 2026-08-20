-- Phase 2: canonical adaptive lesson completion.
--
-- 1. learner_lesson_completions.quiz_score was NOT NULL + CHECK (> 0),
--    which made it structurally impossible to ever complete a lesson that
--    has no quiz material at all. Relaxed so a quiz-less completion can be
--    represented (quiz_score = null) while quiz-backed completions keep
--    exactly the same validation as before (a positive score).
alter table public.learner_lesson_completions
  alter column quiz_score drop not null;

alter table public.learner_lesson_completions
  drop constraint if exists learner_lesson_completions_quiz_score_check;

alter table public.learner_lesson_completions
  add constraint learner_lesson_completions_quiz_score_check
  check (quiz_score is null or quiz_score > 0);

-- 2. Reading completion needs a genuine, persisted signal independent of
--    quiz state (previously the "reading" tick was proxied from quiz
--    success, which breaks for reading-only lessons and conflates two
--    unrelated things). Reuses the existing per-(learner,lesson) progress
--    table rather than introducing a second progress-tracking system.
alter table public.learner_lesson_progress
  add column if not exists reading_completed_at timestamptz null;
