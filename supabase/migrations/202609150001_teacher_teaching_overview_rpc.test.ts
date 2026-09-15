import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This migration cannot be executed against a real database in a plain
// node:test run -- these tests verify the SQL source text directly
// (mirroring this codebase's established source-inspection convention
// for files that cannot be safely invoked outside their real runtime,
// e.g. lib/supabase/coinLedger.test.ts's header comment).

const SOURCE = readFileSync(
  "supabase/migrations/202609150001_teacher_teaching_overview_rpc.sql",
  "utf8",
);
const fnBody = SOURCE.slice(
  SOURCE.indexOf("create or replace function public.get_teacher_teaching_overview("),
  SOURCE.indexOf("$$;") + 3,
);

test("H: authorised subject scope is derived entirely from teacher_subjects keyed on p_teacher_profile_id -- the function never accepts a subject id or list of subject ids", () => {
  assert.match(
    fnBody,
    /create or replace function public\.get_teacher_teaching_overview\(\s*\n\s*p_teacher_profile_id uuid\s*\n\)/,
  );
  assert.doesNotMatch(fnBody, /p_subject_id/i);
  assert.doesNotMatch(fnBody, /uuid\[\]/);

  const joinCount = (
    fnBody.match(/join public\.teacher_subjects ts\s*\n\s*on ts\.subject_id = \S+/g) ??
    []
  ).length;
  assert.equal(
    joinCount,
    4,
    "expected all four subject-scoped queries (active_learners, published_lessons, published_activities, submissions_awaiting_review) to join teacher_subjects",
  );
  assert.match(fnBody, /ts\.teacher_profile_id = p_teacher_profile_id/);
  assert.match(fnBody, /ts\.status = 'active'/);
});

test("H: active-learner semantics match the exact existing filter -- learner_subjects.status = 'approved' AND is_active = true, DISTINCT learner_profile_id", () => {
  assert.match(fnBody, /ls\.status = 'approved'/);
  assert.match(fnBody, /ls\.is_active = true/);
  assert.match(fnBody, /count\(distinct ls\.learner_profile_id\)/);
});

test("H: published-lesson semantics match the exact existing filter -- lessons.status = 'published'", () => {
  const publishedCount = (fnBody.match(/status = 'published'/g) ?? []).length;
  assert.equal(
    publishedCount,
    3,
    "expected l.status = 'published' to gate published_lessons, published_activities, and submissions_awaiting_review",
  );
});

test("H: published-activities reaches activities via lesson_materials.lesson_id -> lessons.id, exactly the existing relationship chain", () => {
  assert.match(
    fnBody,
    /from public\.activities a\s*\n\s*join public\.lesson_materials lm on lm\.id = a\.lesson_material_id\s*\n\s*join public\.lessons l\s*\n\s*on l\.id = lm\.lesson_id\s*\n\s*and l\.status = 'published'/,
  );
});

test("H: submissions-awaiting-review uses the exact three status values currently used by getTeacherTeachingOverview() -- not guessed or renamed", () => {
  assert.match(
    fnBody,
    /asub\.status in \('submitted', 'marking_failed', 'awaiting_review'\)/,
  );
  assert.match(
    fnBody,
    /from public\.activity_submissions asub\s*\n\s*join public\.activities a on a\.id = asub\.activity_id/,
  );
});

test("H: every aggregate uses count(*) or count(distinct ...) -- no row data or id arrays are ever selected/returned", () => {
  const plainCounts = (fnBody.match(/select count\(\*\)/g) ?? []).length;
  assert.equal(plainCounts, 4, "expected 4 plain count(*) aggregates (subjects_taught, published_lessons, published_activities, submissions_awaiting_review)");
  assert.doesNotMatch(fnBody, /select \*/);
  assert.doesNotMatch(fnBody, /select id\b/i);
});

test("H: the returned shape is exactly the five TeacherTeachingOverview fields, snake_case", () => {
  assert.match(
    fnBody,
    /returns table \(\s*\n\s*subjects_taught integer,\s*\n\s*active_learners integer,\s*\n\s*published_lessons integer,\s*\n\s*published_activities integer,\s*\n\s*submissions_awaiting_review integer\s*\n\)/,
  );
});

test("H: safe security configuration -- security definer, explicit empty search_path, and execute revoked from public with no grant to authenticated/public", () => {
  assert.match(fnBody, /security definer/);
  assert.match(fnBody, /set search_path = ''/);
  assert.match(
    SOURCE,
    /revoke all on function public\.get_teacher_teaching_overview\(uuid\) from public;/,
  );
  assert.doesNotMatch(SOURCE, /grant execute on function public\.get_teacher_teaching_overview/);
  assert.doesNotMatch(SOURCE, /^grant execute.*to authenticated/m);
});

test("H: a stale/invalid teacher_profile_id is rejected before any aggregation runs, as a data-integrity guard", () => {
  assert.match(
    fnBody,
    /if not exists \(\s*\n\s*select 1\s*\n\s*from public\.teacher_profiles\s*\n\s*where id = p_teacher_profile_id\s*\n\s*and status = 'active'\s*\n\s*\) then\s*\n\s*raise exception 'TEACHER_PROFILE_NOT_FOUND'/,
  );
});

test("regression: the function body uses only fully-qualified public.* table references (consistent with search_path = '')", () => {
  const fromClauses = fnBody.match(/from public\.\w+/g) ?? [];
  assert.ok(fromClauses.length >= 5, "expected every FROM clause to be schema-qualified");
  assert.doesNotMatch(fnBody, /\bfrom (?!public\.)\w+ /);
});

test("regression: notify pgrst reload schema is present, matching every other RPC migration in this repo", () => {
  assert.match(SOURCE, /notify pgrst, 'reload schema';/);
});
