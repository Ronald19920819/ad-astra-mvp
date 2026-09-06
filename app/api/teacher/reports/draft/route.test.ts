import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/teacher/reports/draft/route.ts", "utf8");

test("GET (reopen) requires teacher authorization for the requested subject", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}/)?.[0];
  assert.ok(getFn, "GET not found");
  assert.match(getFn!, /authorizeTeacher\(subjectId\)/);
});

test("GET reopens via findMonthlyReportDraft, which only ever matches a row still in draft status -- a finalised report is never returned here", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}/)?.[0];
  assert.ok(getFn);
  assert.match(getFn!, /findMonthlyReportDraft\(/);
  assert.doesNotMatch(getFn!, /getMonthlyReportById|listMonthlyReportsForLearnerSubject/);
});

test("POST (save) requires teacher authorization and never accepts teacherId from the client", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /authorizeTeacher\(subjectId\)/);
  assert.doesNotMatch(SOURCE, /payload\.teacherId|body\.teacherId/);
  assert.match(postFn!, /teacherId: authorization\.teacher\.profileId/);
});

test("POST saves through saveMonthlyReportDraft only -- never a direct client-triggered write to a finalised report's fields", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  assert.match(postFn!, /saveMonthlyReportDraft\(/);
  assert.doesNotMatch(postFn!, /status: "finalised"|finalised_at/);
});

test("both GET and POST normalise the reporting month server-side", () => {
  const occurrences = SOURCE.match(/normalizeReportMonth\(reportMonth\)/g) ?? [];
  assert.equal(occurrences.length, 2);
});

test("this route never calls finalizeMonthlyReport -- finalisation is not exposed through Stage 2's draft endpoint", () => {
  assert.doesNotMatch(SOURCE, /finalizeMonthlyReport/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4D: ONE-REPORT-PER-PERIOD GUARD.
// AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX.
test("GET checks for an existing FINALISED report for the exact period BEFORE ever looking for a draft, and returns only its id", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}\n\nexport async function POST/)?.[0];
  assert.ok(getFn, "GET not found");
  assert.match(getFn!, /findFinalisedMonthlyReportForPeriod\(\{/);
  const finalisedCheckIndex = getFn!.indexOf("findFinalisedMonthlyReportForPeriod({");
  const draftCheckIndex = getFn!.indexOf("findMonthlyReportDraft({");
  assert.ok(finalisedCheckIndex > -1 && draftCheckIndex > -1 && finalisedCheckIndex < draftCheckIndex);
  assert.match(
    getFn!,
    /return NextResponse\.json\(\{ draft: null, finalisedReportId: finalisedReport\.id \}\);/,
  );
});

test("GET never returns the full finalised report -- only its id, so a teacher cannot use this endpoint to read a finalised report's content", () => {
  const getFn = SOURCE.match(/export async function GET\([\s\S]*?\n\}\n\nexport async function POST/)?.[0];
  assert.ok(getFn);
  assert.doesNotMatch(getFn!, /report_snapshot/);
});

test("a new-draft attempt for a period that already has a finalised report is surfaced as a specific 409, never flattened into the generic 500 message", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*findMonthlyReportDraft,\s*\n\s*findFinalisedMonthlyReportForPeriod,\s*\n\s*saveMonthlyReportDraft,\s*\n\s*MonthlyReportPeriodAlreadyFinalisedError,\s*\n\s*\} from "@\/lib\/reports\/monthlyReportRepository";/,
  );
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(
    postFn!,
    /if \(error instanceof MonthlyReportPeriodAlreadyFinalisedError\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: error\.message, code: "ALREADY_FINALISED_PERIOD" \},\s*\n\s*\{ status: 409 \},\s*\n\s*\);/,
  );
});
