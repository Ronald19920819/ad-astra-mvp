import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("lib/reports/monthlyReportArchiveRepository.ts", "utf8");

test("the archive list is scoped to status='finalised' only -- a draft can never appear here", () => {
  const start = SOURCE.indexOf("export async function listFinalisedMonthlyReportArchive(");
  assert.ok(start > -1, "listFinalisedMonthlyReportArchive not found");
  const fn = SOURCE.slice(start);
  assert.match(fn, /\.eq\("status", "finalised"\)/);
});

test("the archive query never selects report_snapshot, kingdom_comments, or teacher_edited_comments -- only the lean metadata an archive card needs", () => {
  const selectCalls = [...SOURCE.matchAll(/\.select\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(selectCalls.length > 0, "expected at least one .select() call");
  for (const columns of selectCalls) {
    assert.doesNotMatch(columns, /report_snapshot|kingdom_comments|teacher_edited_comments/);
  }
});

test("a requested subjectId can never escape the caller's authorised subjectIds -- defense in depth even if the route forgot to validate it", () => {
  assert.match(
    SOURCE,
    /const scopedSubjectIds = subjectId\s*\n\s*\? subjectIds\.filter\(\(id\) => id === subjectId\)\s*\n\s*: subjectIds;/,
  );
  assert.match(SOURCE, /if \(scopedSubjectIds\.length === 0\) return \[\];/);
});

test("an empty authorised subjectIds list short-circuits to an empty archive, never an unscoped query", () => {
  const listFn = SOURCE.match(/export async function listFinalisedMonthlyReportArchive\([\s\S]*?\n\}/)?.[0];
  assert.ok(listFn);
  assert.match(listFn!, /if \(subjectIds\.length === 0\) return \[\];/);
});

test("learner search matches against the resolved display name (first+surname combined), never a raw ILIKE against a column the caller doesn't control", () => {
  assert.match(SOURCE, /entry\.learnerName\.toLowerCase\(\)\.includes\(trimmedSearch\)/);
});

test("sorting is deterministic and explicit -- newest reporting period first, then subject, then learner name -- never left to database/query insertion order", () => {
  const sortFn = SOURCE.match(/entries\.sort\(\(a, b\) => \{[\s\S]*?\n  \}\);/)?.[0];
  assert.ok(sortFn, "entries.sort(...) not found");
  assert.match(sortFn!, /a\.reportMonth !== b\.reportMonth/);
  assert.match(sortFn!, /a\.subjectName !== b\.subjectName/);
  assert.match(sortFn!, /a\.learnerName\.localeCompare\(b\.learnerName\)/);
});

test("subject display names are resolved from the static subject configuration, never an extra database round-trip to the subjects table", () => {
  assert.match(
    SOURCE,
    /import \{ getSubjectConfigurationByDatabaseId \} from "@\/lib\/subjects\/subjectConfig";/,
  );
  assert.match(SOURCE, /getSubjectConfigurationByDatabaseId\(row\.subject_id\)\?\.displayName/);
  assert.doesNotMatch(SOURCE, /\.from\("subjects"\)/);
});

test("listFinalisedMonthlyReportYears is also scoped to status='finalised' and the caller's authorised subjectIds, and returns years newest first", () => {
  const fn = SOURCE.match(/export async function listFinalisedMonthlyReportYears\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "listFinalisedMonthlyReportYears not found");
  assert.match(fn!, /\.eq\("status", "finalised"\)/);
  assert.match(fn!, /\.in\("subject_id", subjectIds\)/);
  assert.match(fn!, /sort\(\(a, b\) => b - a\)/);
});
