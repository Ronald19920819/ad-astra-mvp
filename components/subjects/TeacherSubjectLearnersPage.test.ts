import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This component transitively imports "server-only" (via
// getSubjectLearningTracker -> lib/supabase/learningTrackerReader.ts) and
// cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync(
  "components/subjects/TeacherSubjectLearnersPage.tsx",
  "utf8",
);

// AD ASTRA -- TEACHER SUBJECT LEARNERS DESKTOP ENHANCEMENT + PREFETCH
// SAFEGUARD: this shared roster page drives all four subject families
// (Business Studies, English, Afrikaans, History). The mobile max-w-md
// single-column card stack is unchanged; at lg: the content column widens
// to lg:max-w-6xl and the learner-card collection (only) becomes a
// two-column grid via lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0,
// matching the established Learner Approvals pattern. The header card,
// "Learner subject overview" card, and empty/error states remain full
// width, outside that grid. Each learner card's own internal 2x2 stat
// grid (grid grid-cols-2 gap-3) is untouched -- only the outer collection
// gained a breakpoint. Subject colour theming stays 100% inline-style
// driven via subject.colourTheme.{primary,softBackground,border}; no
// Tailwind subject-colour class was introduced. Separately, the
// previously-missing prefetch={false} on "View Learner Profile" is added,
// matching the prefetch-disable convention already applied to every other
// Teacher navigation link -- its href, buildSubjectDetailRoute() call and
// destination are unchanged.

test("A/B: the outer content wrapper keeps its existing max-w-md and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto max-w-md px-4 pt-4 lg:max-w-6xl">/,
  );
});

test("C/D/E: the learner-card collection keeps its mobile space-y-4 and becomes a two-column grid (not three) at lg:, resetting mobile spacing via lg:space-y-0", () => {
  assert.match(
    SOURCE,
    /<div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">/,
  );
  assert.doesNotMatch(SOURCE, /lg:grid-cols-3/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols/);
});

test("F: each learner card's internal stat grid remains grid grid-cols-2 gap-3, with no lg: breakpoint added to it", () => {
  assert.match(SOURCE, /<div className="grid grid-cols-2 gap-3 text-sm">/);
  assert.doesNotMatch(SOURCE, /grid grid-cols-2 gap-3 lg:grid-cols-2/);
});

test("G: the header card sits before the learner-card collection and outside it", () => {
  const headerIndex = SOURCE.indexOf("Back to Dashboard");
  const collectionIndex = SOURCE.indexOf(
    '<div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">',
  );
  assert.ok(headerIndex > -1 && collectionIndex > -1);
  assert.ok(
    headerIndex < collectionIndex,
    "expected the header card to appear before the learner-card grid wrapper",
  );
});

test("H: the 'Learner subject overview' card sits before the learner-card collection and outside it", () => {
  const overviewIndex = SOURCE.indexOf("Learner subject overview");
  const collectionIndex = SOURCE.indexOf(
    '<div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">',
  );
  assert.ok(overviewIndex > -1 && collectionIndex > -1);
  assert.ok(
    overviewIndex < collectionIndex,
    "expected the overview card to appear before the learner-card grid wrapper",
  );
});

test("I/J: the View Learner Profile link keeps buildSubjectDetailRoute(subject, \"teacherLearners\", learner.id) and now also disables prefetch", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectDetailRoute\(\s*\n\s*subject,\s*\n\s*"teacherLearners",\s*\n\s*learner\.id,\s*\n\s*\)\}\s*\n\s*prefetch=\{false\}/,
  );
});

test("K: the Back to Dashboard link keeps prefetch={false} and its buildSubjectRoute destination", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "teacherOverview"\)\}\s*\n\s*prefetch=\{false\}/,
  );
});

test("L/M: subject colour theming remains inline-style-driven from colourTheme.primary/softBackground/border, with no hardcoded subject colour introduced", () => {
  assert.match(SOURCE, /subject\.colourTheme\.primary/);
  assert.match(SOURCE, /subject\.colourTheme\.softBackground/);
  assert.match(SOURCE, /subject\.colourTheme\.border/);
  assert.doesNotMatch(
    SOURCE,
    /#F97316|#2563EB|#EB2525|#3AAA35|bg-orange|text-orange|border-orange/i,
  );
});

test("N: getLearnerSupportStatus remains referenced, unchanged, and its three labels/colour classes are untouched", () => {
  assert.match(SOURCE, /getLearnerSupportStatus\(learner\.overdueItems\)/);
  assert.match(SOURCE, /"On Track"/);
  assert.match(SOURCE, /"Needs Support"/);
  assert.match(SOURCE, /bg-green-100 text-green-700/);
  assert.match(SOURCE, /bg-yellow-100 text-yellow-700/);
  assert.match(SOURCE, /bg-red-100 text-red-700/);
});

test("O: no bottom navigation was introduced -- this remains a back-link-only page", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});

test("P: the empty and error state wording is present and unchanged", () => {
  assert.match(
    SOURCE,
    /Unable to load learner progress\. Please try again\./,
  );
  assert.match(SOURCE, /No learner participation has been recorded yet\./);
});

test("regression: data flow (tracker fetch, learner Map aggregation, sorting) is unchanged", () => {
  assert.match(
    SOURCE,
    /lessons = await getSubjectLearningTracker\(subject\.databaseId\);/,
  );
  assert.match(
    SOURCE,
    /const learners = \[\.\.\.learnerMap\.values\(\)\]\.sort\(\(a, b\) =>\s*\n\s*a\.name\.localeCompare\(b\.name\),\s*\n\s*\);/,
  );
  assert.match(SOURCE, /console\.error\(`Unable to load \$\{subject\.displayName\} learners:`, error\);/);
});

test("regression: no new product feature (search, filter, sort control, pagination, avatars, marks, email, bulk actions) was introduced", () => {
  assert.doesNotMatch(SOURCE, /<input/);
  assert.doesNotMatch(SOURCE, /type="search"/);
  assert.doesNotMatch(SOURCE, /onChange/);
  assert.doesNotMatch(SOURCE, /learner\.email/);
});
