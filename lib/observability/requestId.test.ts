import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This module calls next/headers's headers(), which throws outside a
// real request-scoped render context, so getDiagnosticRequestId() cannot
// be exercised directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("lib/observability/requestId.ts", "utf8");

test("REQUEST_ID_HEADER is the exact header name proxy.ts sets and downstream readers look for", () => {
  assert.match(SOURCE, /export const REQUEST_ID_HEADER = "x-ad-astra-request-id";/);
});

test("getDiagnosticRequestId never throws -- a missing header context (e.g. outside a real request) returns null rather than crashing the caller", () => {
  const fn = SOURCE.match(/export async function getDiagnosticRequestId\(\)[\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "getDiagnosticRequestId not found");
  assert.match(fn!, /try \{/);
  assert.match(fn!, /\} catch \{\s*\n\s*return null;\s*\n\s*\}/);
});

test("reads the header via next/headers's headers() and returns its raw value only -- no parsing, no fallback to any other identifier", () => {
  const fn = SOURCE.match(/export async function getDiagnosticRequestId\(\)[\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /const headerStore = await headers\(\);/);
  assert.match(fn!, /return headerStore\.get\(REQUEST_ID_HEADER\);/);
});
