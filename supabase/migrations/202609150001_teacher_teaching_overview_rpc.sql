-- AD Astra Teacher Dashboard Reliability -- Teacher Teaching Overview RPC.
--
-- lib/supabase/teacherProfile.ts's getTeacherTeachingOverview() previously
-- computed subjectsTaught/activeLearners/publishedLessons/
-- publishedActivities/submissionsAwaitingReview by manually re-implementing
-- a SQL join in application code: fetch every published lesson id for the
-- teacher's subjects, then every lesson_materials id for those lessons,
-- then every activities id for those materials, feeding each result
-- straight into the next query's .in(...) filter as a UUID array. For a
-- teacher/school with enough accumulated content, that array grew large
-- enough (~425+ UUIDs) to produce a real ~15,851-character PostgREST
-- request URL and UND_ERR_HEADERS_OVERFLOW (HeadersOverflowError) in
-- production -- not a data problem, a request-construction problem: every
-- one of those five returned values is a plain count, never a list, so
-- none of the enumerated ids were ever actually needed by the caller.
--
-- This migration replaces that entire chain with one relational
-- aggregation, computed server-side with real joins and COUNT/COUNT
-- DISTINCT -- exactly what SQL joins exist to avoid re-implementing in
-- application code. No UUID array of any size is ever constructed or
-- transmitted for this computation again.
--
-- SECURITY MODEL: unlike admin_adjust_learner_coins (which legitimately
-- needs `grant ... to authenticated` because a browser can call it
-- directly through the anon-key client, so it re-derives the caller's own
-- identity from auth.uid() as its defense), this function has no such
-- legitimate direct-client use: lib/supabase/teacherProfile.ts always
-- invokes it via createSupabaseAdminClient() (service_role), after
-- getAuthenticatedTeacherProfile() has already resolved and validated the
-- caller's identity earlier in the same request via the cookie-scoped
-- request client's auth.getUser() (the same established pattern already
-- used by every other admin-client query in that file -- identity is
-- confirmed once per request, then trusted for the rest of that request).
-- auth.uid() does not meaningfully resolve for a service_role-authenticated
-- call, so an auth.uid() re-check here would be theatre, not a real
-- control. The actual control is structural and deliberate: EXECUTE is
-- granted ONLY to service_role (never to `authenticated` or `public`), so
-- no teacher/learner session -- however it is obtained -- can invoke this
-- function directly through PostgREST at all. p_teacher_profile_id is
-- never a client-supplied value; only lib/supabase/teacherProfile.ts's own
-- already-resolved profile.teacherProfileId is ever passed. The function
-- still independently verifies that id corresponds to a real, active
-- teacher_profiles row before computing anything, as a data-integrity
-- guard against a stale/bad id -- not as the primary security boundary.
--
-- All subject scope is derived from teacher_subjects (status = 'active')
-- via SQL joins keyed on p_teacher_profile_id -- the function never
-- accepts a client-supplied subject id or list of subject ids, so it
-- cannot be asked to compute statistics for a subject the teacher is not
-- actively assigned to.
--
-- Status/relationship semantics are copied byte-for-byte from the
-- application code being replaced (lib/supabase/teacherProfile.ts,
-- getTeacherTeachingOverview(), as it existed immediately before this
-- migration):
--   activeLearners: learner_subjects.status = 'approved' AND
--     learner_subjects.is_active = true, DISTINCT learner_profile_id
--   publishedLessons: lessons.status = 'published'
--   publishedActivities: activities reached via
--     lesson_materials.lesson_id -> lessons.id (published only)
--   submissionsAwaitingReview: activity_submissions.status IN
--     ('submitted', 'marking_failed', 'awaiting_review') -- the exact
--     three values from the existing .in("status", [...]) filter, not
--     guessed or renamed.
create or replace function public.get_teacher_teaching_overview(
  p_teacher_profile_id uuid
)
returns table (
  subjects_taught integer,
  active_learners integer,
  published_lessons integer,
  published_activities integer,
  submissions_awaiting_review integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subjects_taught integer;
  v_active_learners integer;
  v_published_lessons integer;
  v_published_activities integer;
  v_submissions_awaiting_review integer;
begin
  if not exists (
    select 1
    from public.teacher_profiles
    where id = p_teacher_profile_id
      and status = 'active'
  ) then
    raise exception 'TEACHER_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*)
  into v_subjects_taught
  from public.teacher_subjects ts
  where ts.teacher_profile_id = p_teacher_profile_id
    and ts.status = 'active';

  select count(distinct ls.learner_profile_id)
  into v_active_learners
  from public.learner_subjects ls
  join public.teacher_subjects ts
    on ts.subject_id = ls.subject_id
   and ts.teacher_profile_id = p_teacher_profile_id
   and ts.status = 'active'
  where ls.status = 'approved'
    and ls.is_active = true;

  select count(*)
  into v_published_lessons
  from public.lessons l
  join public.teacher_subjects ts
    on ts.subject_id = l.subject_id
   and ts.teacher_profile_id = p_teacher_profile_id
   and ts.status = 'active'
  where l.status = 'published';

  select count(*)
  into v_published_activities
  from public.activities a
  join public.lesson_materials lm on lm.id = a.lesson_material_id
  join public.lessons l
    on l.id = lm.lesson_id
   and l.status = 'published'
  join public.teacher_subjects ts
    on ts.subject_id = l.subject_id
   and ts.teacher_profile_id = p_teacher_profile_id
   and ts.status = 'active';

  select count(*)
  into v_submissions_awaiting_review
  from public.activity_submissions asub
  join public.activities a on a.id = asub.activity_id
  join public.lesson_materials lm on lm.id = a.lesson_material_id
  join public.lessons l
    on l.id = lm.lesson_id
   and l.status = 'published'
  join public.teacher_subjects ts
    on ts.subject_id = l.subject_id
   and ts.teacher_profile_id = p_teacher_profile_id
   and ts.status = 'active'
  where asub.status in ('submitted', 'marking_failed', 'awaiting_review');

  return query
    select
      v_subjects_taught,
      v_active_learners,
      v_published_lessons,
      v_published_activities,
      v_submissions_awaiting_review;
end;
$$;

-- Deliberately no `grant execute ... to authenticated` -- see the header
-- comment above. Only service_role (which already bypasses grants and
-- RLS entirely) can ever invoke this function; revoking from public
-- closes the default PUBLIC execute grant Postgres applies to newly
-- created functions.
revoke all on function public.get_teacher_teaching_overview(uuid) from public;

comment on function public.get_teacher_teaching_overview is
  'Server-side aggregation of one teacher''s dashboard teaching-overview statistics (subjects taught, active learners, published lessons/activities, submissions awaiting review), replacing the previous application-side lessonIds/materialIds/activityIds .in() chain that could produce an oversized PostgREST request URL. service_role-only (never authenticated/public); p_teacher_profile_id must be a value the caller already resolved and validated, never client input.';

notify pgrst, 'reload schema';
