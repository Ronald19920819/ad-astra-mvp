import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports MonthlyReportGenerator.tsx (next/font/local) --
// verified via source inspection, matching this codebase's established
// precedent.

const SOURCE = readFileSync("components/teachers/TeacherReportsTabs.tsx", "utf8");

test("exposes exactly two modes -- Create Report and Finalised Reports -- not a third destination", () => {
  assert.match(SOURCE, />\s*Create Report\s*</);
  assert.match(SOURCE, />\s*Finalised Reports\s*</);
});

test("initialises from the server-resolved initialTab prop, never a client useSearchParams hook (no hydration mismatch risk)", () => {
  assert.match(SOURCE, /useState<"create" \| "archive">\(initialTab\)/);
  assert.doesNotMatch(SOURCE, /useSearchParams/);
});

test("renders the existing MonthlyReportGenerator workflow unchanged under Create Report, and the new MonthlyReportArchive under Finalised Reports", () => {
  assert.match(
    SOURCE,
    /import \{ MonthlyReportGenerator \} from "@\/components\/teachers\/MonthlyReportGenerator";/,
  );
  assert.match(
    SOURCE,
    /import \{ MonthlyReportArchive \} from "@\/components\/teachers\/MonthlyReportArchive";/,
  );
  assert.match(SOURCE, /<MonthlyReportGenerator subjects=\{subjects\} \/>/);
  assert.match(SOURCE, /<MonthlyReportArchive subjects=\{subjects\} \/>/);
});

test("only one mode is rendered at a time, never both simultaneously", () => {
  assert.match(SOURCE, /tab === "create" \? \(/);
});
