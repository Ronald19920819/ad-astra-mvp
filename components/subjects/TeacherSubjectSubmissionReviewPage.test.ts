import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This is a Server Component that transitively imports "server-only" (via
// getSubjectSubmissionReview -> lib/supabase/activityReviewReader.ts) and
// cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync(
  "components/subjects/TeacherSubjectSubmissionReviewPage.tsx",
  "utf8",
);

// AD ASTRA -- TEACHER SUBMISSION REVIEW DESKTOP ENHANCEMENT (MINIMAL
// PASS): this is the lightest change in the whole Teacher desktop pass.
// The investigation established that this page's only meaningful width
// constraint is its own outer wrapper -- TeacherSubmissionReviewForm.tsx
// (the actual marking UI) has no max-width of its own and naturally
// inherits the wider parent, exactly like ActivityQuestionBuilder did on
// the Activities page. The outer wrapper keeps its existing max-w-2xl
// base and gains lg:max-w-6xl. Nothing else changed: no columns, no
// split, no sidebar, no sticky summary -- the header card, reading
// preview, and TeacherSubmissionReviewForm remain in their exact
// sequential order, and the load-error branch's own narrow max-w-2xl
// card is untouched (it was not the wrapper this task targeted).

test("A/B/C/D: the outer wrapper keeps its existing max-w-2xl, px-4 and pt-4, and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto max-w-2xl px-4 pt-4 lg:max-w-6xl">/,
  );
});

test("E/F: the page still renders TeacherSubmissionReviewForm with the review and subjectKey props unchanged", () => {
  assert.match(
    SOURCE,
    /<TeacherSubmissionReviewForm\s*\n\s*review=\{review\}\s*\n\s*subjectKey=\{subjectKey\}\s*\n\s*\/>/,
  );
});

test("G/H/I: both 'Back to Activity Review' links remain present, each retaining prefetch={false}", () => {
  const backLinkMatches =
    SOURCE.match(
      /href=\{buildSubjectRoute\(subject, "teacherReview"\)\}\s*\n\s*prefetch=\{false\}/g,
    ) ?? [];
  assert.equal(
    backLinkMatches.length,
    2,
    "expected exactly 2 'Back to Activity Review' links, both with prefetch={false} (load-error branch + normal render)",
  );
  assert.match(SOURCE, /Back to Activity Review/);
});

test("J/K: activity title and learner name remain rendered, unchanged", () => {
  assert.match(SOURCE, /\{review\.activity\.title\}/);
  assert.match(SOURCE, /\{review\.learnerName\}/);
});

test("L/M: submission timing remains rendered via getSubmissionTiming, unchanged", () => {
  assert.match(
    SOURCE,
    /const timing = getSubmissionTiming\(\s*\n\s*review\.submittedAt,\s*\n\s*review\.activity\.dueDate,\s*\n\s*\);/,
  );
  assert.match(SOURCE, /\{timing\.label\}/);
  assert.match(SOURCE, /\$\{timing\.className\}/);
});

test("N: the returned-status pill presentation remains unchanged", () => {
  assert.match(
    SOURCE,
    /\{review\.status === "returned" && \(\s*\n\s*<p className="mt-4 rounded-full bg-green-100 px-3 py-2 text-center text-sm font-bold text-green-700">\s*\n\s*Status: Returned/,
  );
});

test("O/P/Q: the reading-preview section remains present, referencing both ProtectedPdfReading and StructuredReadingContent unchanged", () => {
  assert.match(SOURCE, /import { ProtectedPdfReading } from "@\/components\/learners\/ProtectedPdfReading";/);
  assert.match(SOURCE, /import { StructuredReadingContent } from "@\/components\/readings\/StructuredReadingContent";/);
  assert.match(SOURCE, /<ProtectedPdfReading\s*\n\s*sourceUrl=/);
  assert.match(SOURCE, /<StructuredReadingContent content=\{review\.reading\.contentText\} \/>/);
});

test("R/S: the reading-preview scroll container retains max-h-[32rem] and overflow-y-auto", () => {
  assert.match(
    SOURCE,
    /<div className="max-h-\[32rem\] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">/,
  );
});

test("T: the subject-theme style block remains present, unchanged", () => {
  assert.match(SOURCE, /\.subject-theme \.bg-orange-500 \{/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-50 \{/);
  assert.match(SOURCE, /\.subject-theme \.text-orange-500 \{/);
  assert.match(SOURCE, /\.subject-theme \.border-orange-100 \{/);
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
});

test("U: no bottom navigation was introduced", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});

test("V: no lg:grid-cols-2 marking split was introduced in this page file", () => {
  assert.doesNotMatch(SOURCE, /lg:grid-cols-2/);
  assert.doesNotMatch(SOURCE, /lg:grid\b/);
  assert.doesNotMatch(SOURCE, /lg:flex-row/);
});

test("W: no sticky positioning was introduced in this page file", () => {
  assert.doesNotMatch(SOURCE, /sticky/i);
});

test("regression: header card content (title/learner/timing/submitted/due-date block) remains in its exact existing structure, before the reading-preview section", () => {
  const headerIndex = SOURCE.indexOf("Back to Activity Review", SOURCE.indexOf("mx-auto max-w-2xl px-4 pt-4"));
  const readingIndex = SOURCE.indexOf("review.reading.title");
  const formIndex = SOURCE.indexOf("<TeacherSubmissionReviewForm");
  assert.ok(headerIndex > -1 && readingIndex > -1 && formIndex > -1);
  assert.ok(headerIndex < readingIndex, "expected the header card before the reading-preview section");
  assert.ok(readingIndex < formIndex, "expected the reading-preview section before TeacherSubmissionReviewForm");
});

test("regression: the load-error branch's own narrow card is untouched -- this task targeted only the normal-render wrapper", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto max-w-2xl rounded-\[2rem\] border border-orange-100 bg-white p-5 shadow-sm">/,
  );
});

test("regression: main element's min-height, background, and pb-24 bottom padding are unchanged, despite this page having no bottom navigation", () => {
  assert.match(
    SOURCE,
    /className="subject-theme min-h-screen bg-slate-100 pb-24"/,
  );
});

test("regression: only one lg: class exists in the whole file -- lg:max-w-6xl on the outer wrapper", () => {
  const lgMatches = SOURCE.match(/lg:[\w[\]/.-]+/g) ?? [];
  assert.deepEqual(lgMatches, ["lg:max-w-6xl"]);
});
