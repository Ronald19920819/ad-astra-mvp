alter table public.activity_submissions
  add column if not exists teacher_comment text null;
