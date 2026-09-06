import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This page transitively imports "server-only" (via
// monthlyReportShareRepository.ts) and JSX, so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([token]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/report/[token]/page.test.ts"

const SOURCE = readFileSync("app/report/[token]/page.tsx", "utf8");

test("resolves the report exclusively through getReportBySharetoken -- never the live report engine, never a generic report-by-id lookup", () => {
  assert.match(SOURCE, /getReportBySharetoken\(token\)/);
  assert.doesNotMatch(SOURCE, /generateMonthlyReportPreview|getMonthlyReportById/);
});

test("renders strictly from the frozen report_snapshot and the resolved approved commentary -- nothing else is passed to the view", () => {
  assert.match(SOURCE, /<PublicMonthlyReportView report=\{report\.report_snapshot\} comments=\{comments\} \/>/);
});

test("an invalid, revoked, or unmatched token renders the same unavailable state -- no distinguishing information is shown", () => {
  assert.match(SOURCE, /if \(!report \|\| !report\.report_snapshot\) \{\s*\n\s*return <ReportUnavailable \/>;/);
});

test("this page requires no authentication -- it never imports any auth/session/teacher-authorization helper", () => {
  assert.doesNotMatch(SOURCE, /authorizeTeacher|createSupabaseRequestClient|getAuthenticatedLearnerProfile/);
});
