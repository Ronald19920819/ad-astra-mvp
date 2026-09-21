import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via getAuthenticatedTeacherProfile /
// getTeacherSubjectSummaryForTeacher) -- verified via source inspection,
// matching this codebase's established precedent (see app/teacher/page.test.ts).

const SOURCE = readFileSync("app/teacher/subjects/page.tsx", "utf8");

// AD ASTRA -- TEACHER SUBJECTS DESKTOP ENHANCEMENT: the page's mobile-only
// max-w-md content column and bottom nav now widen at lg:, following the
// exact pattern already shipped on the Teacher Dashboard
// (app/teacher/page.tsx). The single-column subject-card list becomes a
// two-column grid at lg: (not three -- a deliberate choice for this pass).
// No content, copy, data-fetching, auth, subject colour, or navigation
// destination changed.

test("A: the responsive content wrapper keeps its mobile max-w-md and adds lg:max-w-6xl, matching the Teacher Dashboard's exact pattern", () => {
  assert.match(SOURCE, /<div className="max-w-md mx-auto lg:max-w-6xl">/);
});

test("B: the subject list keeps its mobile single-column space-y-4 stack and becomes a two-column grid at lg:", () => {
  assert.match(
    SOURCE,
    /<div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">/,
  );
  // Explicitly not a three-column grid for this pass.
  assert.doesNotMatch(SOURCE, /xl:grid-cols-3/);
  assert.doesNotMatch(SOURCE, /lg:grid-cols-3/);
});

test("C: the desktop subject grid resets mobile vertical spacing (lg:space-y-0) in favour of the grid's own lg:gap-6, exactly once", () => {
  const spaceY0Count = (SOURCE.match(/lg:space-y-0/g) ?? []).length;
  assert.equal(spaceY0Count, 1, "expected lg:space-y-0 to appear exactly once, on the subject list");

  const gap6Count = (SOURCE.match(/lg:gap-6/g) ?? []).length;
  assert.equal(gap6Count, 1, "expected lg:gap-6 to appear exactly once, on the subject list");
});

test("D: the fixed bottom navigation widens in lockstep with the content wrapper (max-w-md ... lg:max-w-6xl)", () => {
  assert.match(
    SOURCE,
    /<div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">/,
  );
});

test("E: subject colour is still driven entirely by subject.subject.colourTheme.primary -- no generic/shared colour was introduced", () => {
  const colourUsages = (SOURCE.match(/subject\.subject\.colourTheme\.primary/g) ?? []).length;
  assert.equal(colourUsages, 1, "expected exactly one colourTheme.primary usage, on the icon tile background");
  assert.doesNotMatch(SOURCE, /colourTheme\.primary \?\?/);
});

test("F: prefetch={false} remains present on every subject card link and every bottom navigation link", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject\.subject, "teacherOverview"\)\}\s*\n\s*prefetch=\{false\}/,
  );

  for (const href of [
    "/teacher",
    "/teacher/subjects",
    "/teacher/messages",
    "/teacher/reports",
    "/teacher/profile",
  ]) {
    assert.match(
      SOURCE,
      new RegExp(`<Link href="${href.replace(/\//g, "\\/")}" prefetch=\\{false\\}>`),
    );
  }
});

test("regression: every subject card still shows its icon, display name, learner count, pending review count, and chevron", () => {
  assert.match(SOURCE, /subjectIcons\[subject\.subject\.iconKey\]/);
  assert.match(SOURCE, /\{subject\.subject\.displayName\}/);
  assert.match(SOURCE, /<strong>Learners:<\/strong>/);
  assert.match(SOURCE, /\{subject\.summary\.learnerCount\}/);
  assert.match(SOURCE, /<strong>Pending Reviews:<\/strong>/);
  assert.match(SOURCE, /\{subject\.summary\.pendingReviewCount\}/);
  assert.match(SOURCE, /›/);
});

test("regression: the subject card's own border, radius, and shadow classes are unchanged", () => {
  assert.match(
    SOURCE,
    /className="flex items-center gap-4 rounded-\[2rem\] border border-blue-100 bg-white px-4 py-4 shadow-sm"/,
  );
});

test("regression: the hero banner's own markup, copy, and fixed 260px height are unchanged by this pass", () => {
  assert.match(SOURCE, /height: "260px"/);
  assert.match(SOURCE, /Faculty Subjects/);
  assert.match(SOURCE, /Subject Management/);
  assert.match(SOURCE, /backgroundImage: "url\('\/hero-banner-2\.png'\)"/);
});

test("regression: the enrolment manager is still rendered conditionally with an unchanged prop, and its component file is not imported/modified from elsewhere in this pass", () => {
  assert.match(
    SOURCE,
    /\{enrolmentSubjects\.length > 0 && \(\s*\n\s*<TeacherSubjectEnrolmentManager subjects=\{enrolmentSubjects\} \/>\s*\n\s*\)\}/,
  );
});

test("regression: this desktop change does not touch data/auth logic -- getAuthenticatedTeacherProfile and getTeacherSubjectSummaryForTeacher are still called exactly as before", () => {
  assert.match(SOURCE, /const teacherProfile = await getAuthenticatedTeacherProfile\(\);/);
  assert.match(
    SOURCE,
    /await getTeacherSubjectSummaryForTeacher\(\s*\n\s*teacherProfile,\s*\n\s*subject\.databaseId,\s*\n\s*\)/,
  );
  assert.match(SOURCE, /await Promise\.allSettled\(/);
});
