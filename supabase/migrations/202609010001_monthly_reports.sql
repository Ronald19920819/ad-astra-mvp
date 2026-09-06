-- AD Astra Monthly Learner Report -- Stage 1: persistence foundation.
--
-- Subject-agnostic (works for Business Studies, English, Afrikaans,
-- History alike, mirroring lessons/activities themselves). A report is
-- explicitly teacher-scoped: the teacher selects the lessons/activities
-- that belong to the reporting period, so selection is stored directly
-- (selected_lesson_ids/selected_activity_ids) rather than inferred from
-- calendar dates.
--
-- report_snapshot freezes the deterministic MonthlyReportPayload
-- (lib/reports/monthlyReportTypes.ts) once a report is finalised, mirroring
-- the already-proven activity_snapshot pattern on activity_submissions
-- (lib/activities/activitySnapshot.ts): once frozen, later edits to
-- lessons/activities/marks/topics must never change what a finalised
-- report says. A draft may hold the latest generated preview snapshot,
-- but only a finalised report's snapshot is historically authoritative.
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),

  -- learner_id follows the same convention as activity_submissions.learner_id
  -- and coin_transactions.learner_id: the learner's auth.users id, never
  -- profiles.id or learner_profiles.id.
  learner_id uuid not null references auth.users(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,

  -- teacher_id follows the corrected convention established by
  -- activity_submissions.reviewed_by (see 202607210002_teacher_reviewed_by_
  -- profile.sql): public.profiles.id, not auth.users.id.
  teacher_id uuid not null references public.profiles(id) on delete restrict,

  -- First day of the reporting month (e.g. 2026-08-01), never a free-text
  -- month label -- a real date sorts/filters/indexes correctly.
  report_month date not null,

  status text not null default 'draft'
    check (status in ('draft', 'finalised')),

  -- Explicit teacher selection -- never inferred from calendar dates.
  selected_lesson_ids uuid[] not null default '{}',
  selected_activity_ids uuid[] not null default '{}',

  -- The deterministic MonthlyReportPayload (JSON-safe). Null only before
  -- the first draft calculation has ever been run for this row.
  report_snapshot jsonb null,

  -- AI-generated and teacher-edited comment sets. Structurally present
  -- from Stage 1 even though Kingdom generation itself is a later stage --
  -- both remain null until that stage exists.
  kingdom_comments jsonb null,
  teacher_edited_comments jsonb null,

  badge text null
    check (badge in ('stellar', 'on_course', 'course_correction')),

  finalised_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A finalised report must always carry the frozen facts it claims to
  -- represent -- never "finalised" with nothing actually frozen.
  constraint monthly_reports_finalised_requires_snapshot check (
    status <> 'finalised'
    or (report_snapshot is not null and finalised_at is not null)
  ),

  -- report_month is always the first of its month -- rejects an
  -- accidental arbitrary day-of-month value at the database level.
  constraint monthly_reports_report_month_is_month_start check (
    report_month = date_trunc('month', report_month)::date
  )
);

create index if not exists monthly_reports_learner_idx
  on public.monthly_reports (learner_id);

create index if not exists monthly_reports_subject_idx
  on public.monthly_reports (subject_id);

create index if not exists monthly_reports_teacher_idx
  on public.monthly_reports (teacher_id);

create index if not exists monthly_reports_status_idx
  on public.monthly_reports (status);

create index if not exists monthly_reports_learner_subject_month_idx
  on public.monthly_reports (learner_id, subject_id, report_month);

alter table public.monthly_reports enable row level security;

-- Mirrors can_manage_subject_topics's exact join pattern (profiles ->
-- teacher_profiles -> teacher_subjects), under its own honestly-named
-- function rather than reusing the topics-specific one -- same
-- established authorisation shape as subject_topics/subject_events/
-- subject_announcements, applied to a new resource.
create or replace function public.can_manage_subject_reports(
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

revoke all on function public.can_manage_subject_reports(uuid) from public;
grant execute on function public.can_manage_subject_reports(uuid) to authenticated;

-- Teacher-only access. No learner policy exists at all in Stage 1 -- with
-- RLS enabled and no matching policy, every learner request is denied by
-- default, which is exactly right: there is no learner-facing report
-- surface yet, so nothing should be overbuilt here.
create policy "Authorised teachers can read their subject's monthly reports"
  on public.monthly_reports
  for select
  to authenticated
  using (public.can_manage_subject_reports(subject_id));

create policy "Authorised teachers can create monthly reports for their subject"
  on public.monthly_reports
  for insert
  to authenticated
  with check (public.can_manage_subject_reports(subject_id));

create policy "Authorised teachers can update their subject's monthly reports"
  on public.monthly_reports
  for update
  to authenticated
  using (public.can_manage_subject_reports(subject_id))
  with check (public.can_manage_subject_reports(subject_id));

-- No delete policy: nothing in this stage's product design deletes a
-- report through the application. Deliberately not built in Stage 1.

revoke all on table public.monthly_reports from anon;
grant select, insert, update
  on table public.monthly_reports
  to authenticated;

create or replace function public.set_monthly_reports_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_monthly_reports_updated_at
  on public.monthly_reports;

create trigger set_monthly_reports_updated_at
  before update on public.monthly_reports
  for each row
  execute function public.set_monthly_reports_updated_at();

comment on table public.monthly_reports is
  'One row per teacher-generated monthly learner progress report. report_snapshot freezes the deterministic payload at finalisation; drafts may hold a recomputable preview.';

notify pgrst, 'reload schema';
