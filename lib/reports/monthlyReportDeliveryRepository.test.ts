import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("lib/reports/monthlyReportDeliveryRepository.ts", "utf8");

function sliceFunction(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start);
  assert.ok(start > -1 && end > start, `could not locate ${startMarker} .. ${endMarker}`);
  return SOURCE.slice(start, end);
}

test("recordMonthlyReportDelivery always INSERTs a new row -- never an update -- so a resend can never overwrite an earlier delivery record", () => {
  const fn = sliceFunction(
    "export async function recordMonthlyReportDelivery(",
    "export async function listDeliveriesForReport(",
  );
  assert.match(fn, /\.insert\(\{/);
  assert.doesNotMatch(fn, /\.update\(/);
});

test("recordMonthlyReportDelivery accepts both sent and failed status, so a failed send is recorded exactly like a successful one", () => {
  const fn = sliceFunction(
    "export async function recordMonthlyReportDelivery(",
    "export async function listDeliveriesForReport(",
  );
  assert.match(fn, /status: "sent" \| "failed";/);
});

test("listDeliveriesForReport orders by sent_at descending -- the most recent send attempt first", () => {
  const fn = SOURCE.match(/export async function listDeliveriesForReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /order\("sent_at", \{ ascending: false \}\)/);
});
