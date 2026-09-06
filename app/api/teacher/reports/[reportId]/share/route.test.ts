import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([reportId]). Node's own `--test` CLI flag treats "[reportId]" as a
// glob character class even for a literal file argument, so it silently
// discovers ZERO tests here when run via the usual
// `find ... | xargs tsx --test` invocation. Run this file explicitly:
//   node --import tsx "app/api/teacher/reports/[reportId]/share/route.test.ts"

const SOURCE = readFileSync("app/api/teacher/reports/[reportId]/share/route.ts", "utf8");

test("GET never creates or revokes a share -- it only reads status", () => {
  const fn = SOURCE.match(/export async function GET\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "GET not found");
  assert.doesNotMatch(fn!, /createShareForReport|revokeActiveShareForReport/);
  assert.match(fn!, /getActiveShareForReport\(reportId\)/);
});

test("POST requires the report to be finalised before any share can be created -- a draft is rejected outright", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}\n\nexport async function DELETE/)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /existing\.status !== "finalised"/);
  assert.match(postFn!, /NOT_FINALISED/);
});

test("POST authorizes the teacher against the report's own subject before touching any share", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}\n\nexport async function DELETE/)?.[0];
  assert.ok(postFn);
  assert.match(postFn!, /authorizeTeacher\(existing\.subject_id\)/);
});

test("the default 'ensure' action never revokes an existing active share -- it only returns or creates one", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}\n\nexport async function DELETE/)?.[0];
  assert.ok(postFn);
  const ensureBranch = postFn!.slice(postFn!.indexOf('if (action === "regenerate")'));
  const afterRegenerate = ensureBranch.slice(ensureBranch.indexOf("\n}\n") + 3);
  assert.doesNotMatch(afterRegenerate, /revokeActiveShareForReport/);
});

test("'ensure' returns a working URL for an already-active share, since the token is stored retrievably", () => {
  assert.match(
    SOURCE,
    /if \(existingShare\) \{\s*return NextResponse\.json\(\{ active: true, url: buildPublicReportUrl\(existingShare\.token\) \}\);/,
  );
});

test("'regenerate' explicitly revokes the current share before creating a brand-new one -- never restoring a compromised token", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}\n\nexport async function DELETE/)?.[0];
  assert.ok(postFn);
  const regenIndex = postFn!.indexOf('action === "regenerate"');
  const revokeIndex = postFn!.indexOf("revokeActiveShareForReport(reportId)");
  const createIndex = postFn!.indexOf("createShareForReport({");
  assert.ok(regenIndex > -1 && revokeIndex > -1 && createIndex > -1);
  assert.ok(regenIndex < revokeIndex && revokeIndex < createIndex);
});

test("DELETE authorizes the teacher before revoking, and never restores a token afterwards", () => {
  const deleteFn = SOURCE.match(/export async function DELETE\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(deleteFn, "DELETE not found");
  assert.match(deleteFn!, /authorizeTeacher\(existing\.subject_id\)/);
  assert.match(deleteFn!, /revokeActiveShareForReport\(reportId\)/);
  assert.doesNotMatch(deleteFn!, /createShareForReport/);
});

test("the public URL is never built from a raw database UUID -- only from the share token", () => {
  const buildFn = SOURCE.match(/function buildPublicReportUrl\([\s\S]*?\n\}/)?.[0];
  assert.ok(buildFn);
  assert.match(buildFn!, /\/report\/\$\{token\}/);
});
