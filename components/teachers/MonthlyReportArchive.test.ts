import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Imports next/image, which only resolves inside a real Next.js build --
// verified via source inspection, matching this codebase's established
// precedent for such components.

const SOURCE = readFileSync("components/teachers/MonthlyReportArchive.tsx", "utf8");

test("defaults the Academic Year filter to the most recently available year rather than showing an unfiltered list", () => {
  assert.match(SOURCE, /setSelectedYear\(availableYears\[0\]\);/);
});

test("filters (year, month, subject, search) are all sent together in the same request -- they combine rather than override each other", () => {
  const loadFn = SOURCE.match(/async function loadEntries\(\)[\s\S]*?\n    \}/)?.[0];
  assert.ok(loadFn, "loadEntries not found");
  assert.match(loadFn!, /params\.set\("year", String\(selectedYear\)\)/);
  assert.match(loadFn!, /params\.set\("month", String\(selectedMonth\)\)/);
  assert.match(loadFn!, /params\.set\("subjectId", selectedSubjectId\)/);
  assert.match(loadFn!, /params\.set\("search", search\.trim\(\)\)/);
});

test("re-fetches whenever any filter changes, not just on mount", () => {
  assert.match(
    SOURCE,
    /\}, \[years, selectedYear, selectedMonth, selectedSubjectId, search\]\);/,
  );
});

test("shows a distinct 'no reports finalised yet' state from 'no reports match these filters' -- the two are not the same situation", () => {
  assert.match(SOURCE, /No reports have been finalised yet\./);
  assert.match(SOURCE, /No finalised reports match these filters\./);
});

test("each archive entry shows learner name, subject, reporting month/year, frozen badge, and finalised date -- and nothing about marks, completion, or commentary", () => {
  assert.match(SOURCE, /entry\.learnerName/);
  assert.match(SOURCE, /entry\.subjectName/);
  assert.match(SOURCE, /formatReportMonthLabel\(entry\.reportMonth\)/);
  assert.match(SOURCE, /badgeAsset/);
  assert.match(SOURCE, /formatFinalisedDate\(entry\.finalisedAt\)/);
  assert.doesNotMatch(SOURCE, /academicPercentage|topicBreakdown|kingdomComments|academic\./);
});

test("the badge is resolved via the canonical resolver, never a hard-coded/re-implemented map", () => {
  assert.match(
    SOURCE,
    /import \{ resolveMonthlyReportBadgeAsset \} from "@\/lib\/reports\/monthlyReportBadgeAsset";/,
  );
  assert.match(SOURCE, /resolveMonthlyReportBadgeAsset\(entry\.badge\)/);
});

test("an unresolved (null) badge never crashes the archive card -- it renders a neutral fallback instead", () => {
  assert.match(SOURCE, /\{badgeAsset \? \(/);
  assert.match(SOURCE, /badgeAsset\?\.label \?\? "Badge unavailable"/);
});

test("Open Report and Send / Resend both link to the internal historical report route, never the public share-token route", () => {
  assert.match(SOURCE, /href=\{`\/teacher\/reports\/\$\{entry\.id\}`\}/);
  assert.match(SOURCE, /href=\{`\/teacher\/reports\/\$\{entry\.id\}#send-progress-report`\}/);
  assert.doesNotMatch(SOURCE, /\/report\/\$\{/);
});

test("Send / Resend deep-links to the delivery section anchor rather than opening a second/duplicate email form in the archive itself", () => {
  assert.match(SOURCE, /#send-progress-report/);
  assert.doesNotMatch(SOURCE, /mainRecipient|ccRecipients|Send Report</);
});

test("there is no Delete Report action anywhere in the archive", () => {
  assert.doesNotMatch(SOURCE, /Delete Report|delete report/i);
});
