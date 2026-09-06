import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports MonthlyReportGenerator.tsx, which imports
// next/font/local -- only resolves inside a real Next.js build, per this
// codebase's established precedent (see MonthlyReportFinaliseStatus.tsx's
// own header comment). Verified via source inspection instead.

const SOURCE = readFileSync("components/teachers/HistoricalMonthlyReportView.tsx", "utf8");

test("is a Client Component -- required for its reused MonthlyReportPreview import from the 'use client' MonthlyReportGenerator.tsx module to actually work", () => {
  assert.match(SOURCE, /^"use client";/);
});

test("reuses the exact same MonthlyReportPreview the live create-report workflow renders -- no second/duplicate report renderer", () => {
  assert.match(
    SOURCE,
    /import \{ MonthlyReportPreview \} from "@\/components\/teachers\/MonthlyReportGenerator";/,
  );
});

test("always renders with reportStatus fixed to 'finalised' -- this view can never show a draft's editable state", () => {
  assert.match(SOURCE, /reportStatus="finalised"/);
});

test("onDraftUpdated is a genuine no-op -- this view has no live mutation path back to the report", () => {
  assert.match(SOURCE, /onDraftUpdated=\{\(\) => \{\}\}/);
});

test("passes the report's own frozen snapshot, finalised timestamp, and stored commentary straight through -- never recomputed or re-fetched here", () => {
  assert.match(SOURCE, /report=\{report\.report_snapshot\}/);
  assert.match(SOURCE, /finalisedAt=\{report\.finalised_at\}/);
  assert.match(SOURCE, /kingdomComments=\{report\.kingdom_comments\}/);
  assert.match(SOURCE, /teacherEditedComments=\{report\.teacher_edited_comments\}/);
});

test("never imports the live report engine", () => {
  assert.doesNotMatch(SOURCE, /generateMonthlyReportPreview|monthlyReportEngine/);
});
