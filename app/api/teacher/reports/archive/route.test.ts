import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("app/api/teacher/reports/archive/route.ts", "utf8");

test("requires teacher authentication before anything else -- a signed-out or non-teacher request never reaches the archive query", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(getFn, "GET not found");
  assert.match(getFn!, /authorizeTeacher\(\)/);
  const authIndex = getFn!.indexOf("authorizeTeacher()");
  const queryIndex = getFn!.indexOf("resolveAssignedSubjectIds(");
  assert.ok(authIndex > -1 && queryIndex > -1 && authIndex < queryIndex);
});

test("the archive is always scoped to the authenticated teacher's OWN assigned subjects -- never a client-supplied subject list", () => {
  assert.match(
    SOURCE,
    /resolveAssignedSubjectIds\(authorization\.teacher\.teacherProfileId\)/,
  );
});

test("a requested subjectId is validated as a well-formed UUID before ever reaching the repository layer", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(getFn);
  assert.match(getFn!, /if \(subjectIdParam && !uuidPattern\.test\(subjectIdParam\)\)/);
});

test("year and month query parameters are validated as sane integers before use, rejecting garbage input rather than passing it through", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(getFn);
  assert.match(getFn!, /!Number\.isInteger\(year\) \|\| year < 2000 \|\| year > 2100/);
  assert.match(getFn!, /!Number\.isInteger\(month\) \|\| month < 1 \|\| month > 12/);
});

test("resolveAssignedSubjectIds mirrors authorizeTeacher's own teacher_subjects join shape (teacher_profile_id + active status, with the same missing-column fallback)", () => {
  const fn = SOURCE.match(/async function resolveAssignedSubjectIds\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "resolveAssignedSubjectIds not found");
  assert.match(fn!, /\.from\("teacher_subjects"\)/);
  assert.match(fn!, /\.eq\("teacher_profile_id", teacherProfileId\)/);
  assert.match(fn!, /\.eq\("status", "active"\)/);
  assert.match(fn!, /isMissingColumnError\(error\)/);
});

test("never selects report_snapshot or any other full-report field -- only the repository's lean archive metadata is returned", () => {
  assert.doesNotMatch(SOURCE, /report_snapshot|kingdom_comments|teacher_edited_comments/);
});
