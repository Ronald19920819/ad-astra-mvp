import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// AD ASTRA ACADEMIC AVERAGE MODEL CORRECTION -- lib/supabase/
// businessStudiesLearnerOverview.ts cannot be imported directly under
// plain Node/tsx: it starts with `import "server-only"`, a bundler-only
// marker package that fails with MODULE_NOT_FOUND outside Next's build,
// and it issues real Supabase queries. Its arithmetic is already
// exhaustively proven elsewhere:
//   - lib/progress/dueActivityAcademicAverage.test.ts proves the equal-
//     weight classification/averaging itself (10-due/1-returned-38%->3.8%,
//     awaiting-review exclusion, overdue-missing=0%, not-yet-due
//     exclusion, equal weighting regardless of raw marks).
//   - lib/reports/monthlyReportLateness.test.ts proves resolveActivityTiming's
//     overdue/lateness resolution, including the two legacy 24h-window
//     exceptions.
// What's new and unproven here is the WIRING: that the dashboard reader
// feeds calculateDueActivityAcademicAverage from EVERY published, non-quiz
// activity in the subject (not just submitted ones), using the same
// frozen-total resolution and due-date logic as the Monthly Report engine.
// Source-inspection is the established pattern (see monthlyReportEngine's
// own prior-stage tests) for verifying exact wiring in a server-only file
// without a live database.

const source = readFileSync(
  path.join(__dirname, "businessStudiesLearnerOverview.ts"),
  "utf8",
);

test("both return branches (empty-lessons early-return and the main path) expose dueActivityAcademic", () => {
  const occurrences = source.match(/dueActivityAcademic[,:]/g) ?? [];
  assert.ok(
    occurrences.length >= 3,
    "expected the type field plus both return-site assignments",
  );
  assert.match(source, /dueActivityAcademic:\s*calculateDueActivityAcademicAverage\(\[\]\)/);
  assert.match(
    source,
    /return \{\s*progress,\s*dueActivityAcademic,/,
  );
});

test("the equal-weight item list is built from every activity, not only submitted ones", () => {
  assert.match(
    source,
    /const dueActivityAcademicItems: DueActivityAcademicItem\[\] = activities\.map\(/,
  );
});

test("hasAuthoritativeMark requires a returned status with a non-null final_mark -- the exact authoritative gate used everywhere else (Coin engine, review-return email)", () => {
  assert.match(
    source,
    /const hasAuthoritativeMark =\s*\n\s*submission !== null &&\s*\n\s*submission\.status === "returned" &&\s*\n\s*submission\.final_mark !== null;/,
  );
});

test("percentage is derived through submittedTotal (the frozen original_total_marks -> snapshot -> live fallback chain), never the raw live activity.total_marks directly", () => {
  assert.match(
    source,
    /const total = submission \? submittedTotal\(submission\) : 0;\s*\n\s*const percentage =\s*\n\s*hasAuthoritativeMark && total > 0\s*\n\s*\? \(submission!\.final_mark! \/ total\) \* 100\s*\n\s*: null;/,
  );
});

test("isOverdue for the equal-weight model comes from resolveActivityTiming (the same canonical due-date + legacy-exception resolver the Monthly Report engine uses), not a re-derived check", () => {
  assert.match(
    source,
    /const timing = resolveActivityTiming\(\{[\s\S]*?legacyActivity5WindowEnd,\s*\n\s*legacyActivity2WindowEnd,\s*\n\s*now,\s*\n\s*\}\);/,
  );
  assert.match(source, /isOverdue: timing\.isOverdue,/);
});

test("submissionStatus is 'not_submitted' only when there is genuinely no submission row, otherwise the real submission status", () => {
  assert.match(
    source,
    /submissionStatus: submission \? submission\.status : "not_submitted",/,
  );
});

test("the legacy 24h-window lookups are only queried when the corresponding legacy activity is actually present in this subject's activities -- never an unconditional extra query", () => {
  assert.match(
    source,
    /activities\.some\(\s*\n\s*\(activity\) => activity\.id === LEGACY_ACTIVITY_5_ID,\s*\n\s*\)/,
  );
  assert.match(
    source,
    /activities\.some\(\s*\n\s*\(activity\) => activity\.id === LEGACY_ACTIVITY_2_ID,\s*\n\s*\)/,
  );
});

test("lesson-quiz-backed materials remain excluded before activities are ever fetched -- the equal-weight model inherits this pre-existing filter rather than re-deriving it", () => {
  assert.match(
    source,
    /materials\s*\n\s*\.filter\(\(material\) => material\.material_type !== "quiz"\)/,
  );
});

test("no hard-coded 'today' -- resolveActivityTiming and getLearnerActivityStatus both receive the single threaded `now` parameter, never a fresh new Date() read at call time", () => {
  assert.match(
    source,
    /export async function getSubjectLearnerOverview\(\s*\n\s*learnerId: string,\s*\n\s*subjectId: string,\s*\n\s*now = new Date\(\),/,
  );
  // Every call site that resolves timing must pass the threaded `now,`
  // property, never construct its own `new Date()` inline as an argument.
  const timingCallSites = source.match(
    /(resolveActivityTiming|getLearnerActivityStatus)\(\{[\s\S]*?\}\);/g,
  );
  assert.ok(timingCallSites && timingCallSites.length >= 2);
  for (const callSite of timingCallSites!) {
    assert.match(callSite, /\bnow,/);
    assert.doesNotMatch(callSite, /now:\s*new Date\(\)/);
  }
});
