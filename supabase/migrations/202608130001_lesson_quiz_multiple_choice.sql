alter table public.activity_questions
  add column if not exists option_a text,
  add column if not exists option_b text,
  add column if not exists option_c text,
  add column if not exists option_d text,
  add column if not exists correct_option text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_questions_correct_option_check'
  ) then
    alter table public.activity_questions
      add constraint activity_questions_correct_option_check
      check (correct_option is null or correct_option in ('A', 'B', 'C', 'D'));
  end if;
end $$;

notify pgrst, 'reload schema';
