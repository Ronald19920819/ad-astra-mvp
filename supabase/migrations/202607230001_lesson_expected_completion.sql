alter table public.lessons
  add column if not exists expected_completion_date date null;

comment on column public.lessons.expected_completion_date is
  'Optional teacher-supplied date used to determine the learner lesson lifecycle.';

notify pgrst, 'reload schema';
