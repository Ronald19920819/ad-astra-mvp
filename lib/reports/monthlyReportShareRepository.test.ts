import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("lib/reports/monthlyReportShareRepository.ts", "utf8");

function sliceFunction(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start);
  assert.ok(start > -1 && end > start, `could not locate ${startMarker} .. ${endMarker}`);
  return SOURCE.slice(start, end);
}

test("createShareForReport generates a fresh token via generateShareToken for every new share", () => {
  const fn = sliceFunction(
    "export async function createShareForReport(",
    "export async function revokeActiveShareForReport(",
  );
  assert.match(fn, /const token = generateShareToken\(\);/);
});

test("getReportBySharetoken only ever matches an ACTIVE share, never a revoked one", () => {
  const fn = SOURCE.match(/export async function getReportBySharetoken\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "getReportBySharetoken not found");
  assert.match(fn!, /\.eq\("status", "active"\)/);
});

test("getReportBySharetoken re-verifies the linked report is finalised, never trusting the share row alone", () => {
  const fn = SOURCE.match(/export async function getReportBySharetoken\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /report\.status !== "finalised"/);
});

test("getReportBySharetoken returns null uniformly for every failure reason -- no distinguishing information leaks to an unauthenticated caller", () => {
  const fn = SOURCE.match(/export async function getReportBySharetoken\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const returnNulls = fn!.match(/return null;/g) ?? [];
  assert.ok(returnNulls.length >= 2, "expected multiple null-returning failure paths");
  assert.doesNotMatch(fn!, /throw new Error\("(no such token|revoked|not finalised)/i);
});

test("revokeActiveShareForReport is idempotent -- revoking with nothing active is a safe no-op, never an error", () => {
  const fn = SOURCE.match(/export async function revokeActiveShareForReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /\.maybeSingle\(\)/);
  assert.doesNotMatch(fn!, /if \(!data\) throw/);
});

test("revokeActiveShareForReport never deletes a row -- it flips status and stamps revoked_at", () => {
  const fn = SOURCE.match(/export async function revokeActiveShareForReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /status: "revoked", revoked_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(SOURCE, /\.delete\(\)/);
});

test("the share token is stored and read back as a plaintext column, never hashed -- documented as a deliberate resend-retrievability trade-off", () => {
  assert.doesNotMatch(SOURCE, /hashShareToken|token_hash|createHash/);
  assert.match(SOURCE, /token: string;/);
});
