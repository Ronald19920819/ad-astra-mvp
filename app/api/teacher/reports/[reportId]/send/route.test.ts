import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([reportId]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/api/teacher/reports/[reportId]/send/route.test.ts"

const SOURCE = readFileSync("app/api/teacher/reports/[reportId]/send/route.ts", "utf8");

test("recipients are validated before the report/teacher are even loaded from the database", () => {
  const validationIndex = SOURCE.indexOf("normalizeAndValidateRecipients(");
  const loadIndex = SOURCE.indexOf("getMonthlyReportById(reportId)");
  assert.ok(validationIndex > -1 && loadIndex > -1);
  assert.ok(validationIndex < loadIndex);
});

test("authorization is scoped to the report's own subject, resolved from the stored report row -- never a client-supplied subjectId", () => {
  assert.match(SOURCE, /authorizeTeacher\(existing\.subject_id\)/);
});

test("a draft report is rejected outright -- only a finalised report can be sent", () => {
  assert.match(SOURCE, /existing\.status !== "finalised"/);
  assert.match(SOURCE, /NOT_FINALISED/);
});

test("an active share is ensured (reused if present, created if missing) before building the email -- a teacher never has to separately set up the link first", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /getActiveShareForReport\(reportId\)\) \?\?/);
  assert.match(postFn!, /createShareForReport\(\{/);
});

test("the email is built from the frozen report_snapshot's meta fields, never live data", () => {
  assert.match(SOURCE, /existing\.report_snapshot\.meta\.learnerName/);
  assert.match(SOURCE, /existing\.report_snapshot\.meta\.subjectName/);
});

test("exactly one sendEmail call is made per send, using To + CC together", () => {
  const sendCalls = SOURCE.match(/await sendEmail\(/g) ?? [];
  assert.equal(sendCalls.length, 1);
  assert.match(SOURCE, /sendEmail\(\{ to, cc, subject, html \}\)/);
});

test("a failed send is recorded in delivery history with status 'failed' and a failure message, and never touches the report row", () => {
  const failureBranch = SOURCE.slice(
    SOURCE.indexOf("if (!result.success)"),
    SOURCE.indexOf("await recordMonthlyReportDelivery({\n      reportId,\n      mainRecipient: to,\n      ccRecipients: cc,\n      sentBy: authorization.teacher.profileId,\n      status: \"sent\","),
  );
  assert.match(failureBranch, /status: "failed"/);
  assert.match(failureBranch, /failureMessage: result\.error/);
  assert.doesNotMatch(failureBranch, /\.from\("monthly_reports"\)|update\(\{[\s\S]*status:\s*"draft"/);
});

test("a successful send is recorded in delivery history with status 'sent' and the provider message id", () => {
  assert.match(SOURCE, /status: "sent",\s*\n\s*providerMessageId: result\.id,/);
});

test("this route never writes to the monthly_reports table itself -- finalisation status is never affected by a send outcome", () => {
  assert.doesNotMatch(SOURCE, /\.from\("monthly_reports"\)/);
});

test("a send failure responds with sent:false and a clear error, never a silently-swallowed success", () => {
  assert.match(SOURCE, /\{\s*\n\s*sent: false,\s*\n\s*error: `The report email could not be sent: \$\{result\.error\}`,/);
});
