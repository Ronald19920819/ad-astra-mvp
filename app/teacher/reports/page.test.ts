import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via getAuthenticatedTeacherProfile)
// and next/image/next/font -- verified via source inspection, matching
// this codebase's established precedent.

const SOURCE = readFileSync("app/teacher/reports/page.tsx", "utf8");

test("resolves the initial tab from Next's own searchParams prop server-side -- never a client useSearchParams hook", () => {
  assert.match(SOURCE, /searchParams\?: Promise<\{ tab\?: string \}>/);
  assert.match(SOURCE, /const resolvedSearchParams = await searchParams;/);
  assert.match(
    SOURCE,
    /const initialTab = resolvedSearchParams\?\.tab === "archive" \? "archive" : "create";/,
  );
});

test("defaults to the Create Report tab for any tab value other than exactly 'archive'", () => {
  assert.match(SOURCE, /=== "archive" \? "archive" : "create"/);
});

test("renders the tabbed Create Report / Finalised Reports wrapper, not the create-only workflow directly", () => {
  assert.match(
    SOURCE,
    /import \{ TeacherReportsTabs \} from "@\/components\/teachers\/TeacherReportsTabs";/,
  );
  assert.match(SOURCE, /<TeacherReportsTabs subjects=\{subjectOptions\} initialTab=\{initialTab\} \/>/);
  assert.doesNotMatch(SOURCE, /import \{ MonthlyReportGenerator \}/);
});

test("subjects are still scoped to exactly the teacher's own assigned subjects, unchanged from before this stage", () => {
  assert.match(
    SOURCE,
    /teacherProfile\.assignedSubjects\.some\(\s*\n\s*\(assignedSubject\) => assignedSubject\.id === subject\.databaseId,\s*\n\s*\)/,
  );
});
