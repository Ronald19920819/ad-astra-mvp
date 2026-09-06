import assert from "node:assert/strict";
import test from "node:test";

import { formatReportMonthLabel, normalizeReportMonth } from "./monthlyReportMonth";

test("a plain 'YYYY-MM' input (from a native month input) normalises to the first of that month", () => {
  assert.equal(normalizeReportMonth("2026-08"), "2026-08-01");
});

test("a full 'YYYY-MM-DD' input normalises to the first of that month regardless of the given day", () => {
  assert.equal(normalizeReportMonth("2026-08-17"), "2026-08-01");
  assert.equal(normalizeReportMonth("2026-08-01"), "2026-08-01");
});

test("an already-first-of-month value round-trips unchanged", () => {
  assert.equal(normalizeReportMonth("2026-01-01"), "2026-01-01");
});

test("rejects a malformed or out-of-range month", () => {
  assert.throws(() => normalizeReportMonth("August 2026"));
  assert.throws(() => normalizeReportMonth("2026-13"));
  assert.throws(() => normalizeReportMonth("2026-00"));
  assert.throws(() => normalizeReportMonth(""));
  assert.throws(() => normalizeReportMonth("not-a-date"));
});

test("formatReportMonthLabel renders a human-readable label, never the stored date format", () => {
  assert.equal(formatReportMonthLabel("2026-08-01"), "August 2026");
  assert.equal(formatReportMonthLabel("2026-08"), "August 2026");
});

test("formatReportMonthLabel never treats the reporting month as implying which lessons/activities belong to the report", () => {
  // Purely a documentation-style assertion: the label is derived from the
  // stored date ONLY, with no lesson/activity awareness whatsoever --
  // confirmed by the function's own signature (single string in, string
  // out) rather than accepting any selection data.
  assert.equal(formatReportMonthLabel.length, 1);
});
