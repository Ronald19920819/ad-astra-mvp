begin;

alter table public.learner_quiz_attempts
  drop constraint learner_quiz_attempts_check1;

update public.learner_quiz_attempts
set passed = ((quiz_score * 100) >= (quiz_total * 80))
where passed is distinct from ((quiz_score * 100) >= (quiz_total * 80));

alter table public.learner_quiz_attempts
  add constraint learner_quiz_attempts_pass_threshold_check
  check (
    passed = ((quiz_score * 100) >= (quiz_total * 80))
  );

notify pgrst, 'reload schema';

commit;
