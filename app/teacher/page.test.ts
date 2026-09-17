import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via getTeacherDashboardInsights /
// getAuthenticatedTeacherProfile) -- verified via source inspection,
// matching this codebase's established precedent.

const SOURCE = readFileSync("app/teacher/page.tsx", "utf8");

// AD ASTRA -- REQUEST-AMPLIFICATION REDUCTION: the teacher root
// dashboard's bottom navigation and priority-action links (which lead
// into protected, per-subject teacher routes) now explicitly disable
// prefetch. Navigation itself (href, click behaviour) is unchanged.

test("the bottom navigation (Home, Subjects, Messages, Reports, Profile) disables prefetch", () => {
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

test("each dynamic priority-action link disables prefetch, with its real (server-computed) href unchanged", () => {
  assert.match(
    SOURCE,
    /key=\{`\$\{action\.category\}:\$\{action\.subjectId\}`\}\s*\n\s*href=\{action\.href\}\s*\n\s*prefetch=\{false\}/,
  );
});

test("regression: this prefetch change does not touch authentication -- getAuthenticatedTeacherProfile and getTeacherDashboardInsights are still called exactly as before", () => {
  assert.match(SOURCE, /getAuthenticatedTeacherProfile/);
  assert.match(SOURCE, /getTeacherDashboardInsights/);
});

// AD ASTRA -- TEACHER DASHBOARD DESKTOP ENHANCEMENT: the dashboard's
// mobile-only max-w-md content column and bottom nav now widen at lg:,
// following the exact pattern already shipped on learner Home
// (app/home/page.tsx) -- mobile classes are kept, not replaced, and the
// widening only activates at the lg: breakpoint. Two lg:-only two-column
// pairings (School Overview | SchoolOverviewCard, and Priority Actions |
// Learner Insights) use the same lg:grid lg:grid-cols-2 lg:gap-6
// lg:[&>*]:mb-0 wrapper as learner Home, and the four School Overview
// stat tiles gain a 4-column row at lg:. No content, copy, data-fetching,
// auth, or navigation destination changed.

test("the responsive content wrapper keeps its mobile max-w-md and adds lg:max-w-6xl, matching learner Home's exact pattern", () => {
  assert.match(SOURCE, /<div className="max-w-md mx-auto lg:max-w-6xl">/);
});

test("the fixed bottom navigation widens in lockstep with the content wrapper (max-w-md lg:max-w-6xl), matching learner Home's bottom nav", () => {
  assert.match(
    SOURCE,
    /<div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">/,
  );
});

test("the four School Overview stat tiles keep their mobile 2x2 grid and add lg:grid-cols-4", () => {
  assert.match(SOURCE, /<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">/);
});

test("School Overview and SchoolOverviewCard ('Open Subjects') are paired using the approved lg two-column wrapper (Row 1, with its added lg:mb-6 row gap)", () => {
  const wrapperStart = SOURCE.indexOf(
    '<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">',
  );
  assert.notEqual(wrapperStart, -1, "expected Row 1's lg two-column wrapper to be present");

  const firstWrapperBlock = SOURCE.slice(
    wrapperStart,
    SOURCE.indexOf(
      '<div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">',
      wrapperStart + 1,
    ),
  );
  assert.match(firstWrapperBlock, /School Overview/);
  assert.match(firstWrapperBlock, /<SchoolOverviewCard/);
  assert.match(firstWrapperBlock, /href="\/teacher\/subjects"/);
});

test("Priority Actions and Learner Insights are paired using the approved lg two-column wrapper (Row 2, unchanged -- no row gap needed below the last row)", () => {
  const wrapperOccurrences = [
    ...SOURCE.matchAll(
      /<div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:\[&>\*\]:mb-0">/g,
    ),
  ];
  assert.equal(
    wrapperOccurrences.length,
    1,
    "expected exactly one Row 2 wrapper without the lg:mb-6 prefix (Row 1 now carries lg:mb-6)",
  );

  const secondWrapperBlock = SOURCE.slice(wrapperOccurrences[0].index);
  assert.match(secondWrapperBlock, /Priority Actions/);
  assert.match(secondWrapperBlock, /Learner Insights/);
  const priorityIndex = secondWrapperBlock.indexOf("Priority Actions");
  const insightsIndex = secondWrapperBlock.indexOf("Learner Insights");
  assert.ok(
    priorityIndex > -1 && insightsIndex > -1 && priorityIndex < insightsIndex,
    "expected Priority Actions to remain before Learner Insights (unchanged mobile order)",
  );
});

// AD ASTRA -- DESKTOP SPACING FIX: lg:[&>*]:mb-0 neutralises each row's
// own children's mobile mb-5/mb-6 at lg:, which left Row 1 and Row 2
// touching vertically on desktop (no gap between rows, only the
// horizontal lg:gap-6 between columns). Row 1's wrapper now also carries
// lg:mb-6 (24px) so the two desktop rows have the same breathing room
// vertically as they already have horizontally. Mobile spacing (each
// child's own mb-5/mb-6) and the horizontal lg:gap-6 are untouched.

test("Row 1's wrapper adds a 24px desktop-only row gap (lg:mb-6) before Row 2, without touching the horizontal lg:gap-6 or mobile spacing", () => {
  assert.match(
    SOURCE,
    /<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:\[&>\*\]:mb-0">/,
  );

  const mb6Count = (SOURCE.match(/lg:mb-6/g) ?? []).length;
  assert.equal(mb6Count, 1, "expected lg:mb-6 to appear exactly once (Row 1 only, not Row 2)");

  const gap6Count = (SOURCE.match(/lg:gap-6/g) ?? []).length;
  assert.equal(gap6Count, 2, "expected the horizontal lg:gap-6 to remain on both rows, unchanged");
});

test("regression: every section keeps its own mobile mb-5/mb-6 class -- the lg: wrappers are additive, not a replacement for the mobile stacking margins", () => {
  assert.match(SOURCE, /mb-6 overflow-hidden rounded-\[2rem\]/);
  const mb5SectionCount = (
    SOURCE.match(/<section className="mb-5 rounded-\[2rem\]/g) ?? []
  ).length;
  assert.equal(mb5SectionCount, 3, "expected all 3 <section> blocks to keep mb-5");
});

test("regression: the hero banner's own markup, copy, and fixed 260px height are unchanged by this pass", () => {
  assert.match(SOURCE, /height: "260px"/);
  assert.match(SOURCE, /Faculty Dashboard/);
  assert.match(SOURCE, /backgroundImage: "url\('\/hero-banner-2\.png'\)"/);
});

test("regression: the bottom navigation's items, hrefs, and prefetch={false} are unchanged by the lg:max-w-6xl width change", () => {
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
