-- AD Astra Monthly Learner Report -- Stage 4E: database-level enforcement
-- of "one official finalised Monthly Report per learner, subject, and
-- reporting month."
--
-- Stage 4D added an application-level guard (monthlyReportRepository.ts's
-- hasFinalisedMonthlyReport check, thrown as
-- MonthlyReportPeriodAlreadyFinalisedError) as the friendly first layer --
-- it stays in place unchanged. This migration adds the database as the
-- FINAL authority: even if two finalisation attempts somehow raced past
-- that application check (e.g. two concurrent requests both reading "no
-- finalised report yet exists" before either has written its own), the
-- database itself refuses the second one outright.
--
-- Deliberately a PARTIAL index (where status = 'finalised'), never a plain
-- unique index across the whole table: a learner may legitimately have
-- multiple DRAFT rows over time for the same period (e.g. an abandoned
-- draft, or the normal find-or-create-draft flow), and drafts must never
-- be constrained by this rule -- only the one-official-record guarantee
-- for FINALISED reports matters here.
--
-- Safe to apply now: a Stage 4E audit confirmed zero finalised reports
-- share a (learner_id, subject_id, report_month) combination after
-- cleaning up 2 known development/testing duplicate rows (see that
-- stage's report for the exact IDs removed). Creating this index against
-- a table that still had duplicates would fail outright with a Postgres
-- unique-violation error -- this migration is written on the understanding
-- that duplicates have already been resolved, not as a way to discover or
-- force-resolve them.
create unique index if not exists monthly_reports_one_finalised_per_period
  on public.monthly_reports (learner_id, subject_id, report_month)
  where status = 'finalised';

comment on index public.monthly_reports_one_finalised_per_period is
  'Enforces exactly one finalised Monthly Report per (learner_id, subject_id, report_month). Drafts are unrestricted -- this only ever governs finalised rows.';

notify pgrst, 'reload schema';
