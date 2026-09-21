import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This component transitively imports "server-only" (via
// getAuthenticatedTeacherProfile -> lib/supabase/teacherProfile.ts) and
// cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("components/subjects/TeacherSubjectOverviewPage.tsx", "utf8");

// AD ASTRA -- SUBJECT OVERVIEW ERROR PRESENTATION FIX: when the summary
// query genuinely fails, the four zero-valued stats must not be rendered
// as if they were real data next to the error message. The stats grid
// and the error message are now mutually exclusive.

test("the stats grid is only rendered when there is no summaryError -- it is never shown alongside the error message", () => {
  assert.match(SOURCE, /\{summaryError \? \(/);
  const branchBlock = SOURCE.match(/\{summaryError \? \([\s\S]*?\) : \([\s\S]*?<\/div>\s*\n\s*\)\}/)?.[0];
  assert.ok(branchBlock, "summaryError conditional block not found");
  assert.match(branchBlock!, /\{summaryError\}/);
  assert.match(branchBlock!, /summary\.learnerCount/);
});

test("regression: summary still defaults to all-zero only as an initial/failure fallback value -- the real data path is untouched", () => {
  assert.match(
    SOURCE,
    /let summary = \{\s*\n\s*learnerCount: 0,\s*\n\s*pendingReviewCount: 0,\s*\n\s*publishedLessonCount: 0,\s*\n\s*publishedActivityCount: 0,\s*\n\s*\};/,
  );
  assert.match(
    SOURCE,
    /summary = await getTeacherSubjectSummaryForTeacher\(teacherProfile, subject\.databaseId\);/,
  );
});

test("regression: a missing teacher profile (not signed in / session resolution failed) still sets the exact same error message as a thrown summary query", () => {
  const matches = SOURCE.match(/summaryError = "Unable to load the current subject summary\.";/g) ?? [];
  assert.equal(matches.length, 2, "expected the error message in both the catch branch and the missing-profile branch");
});

// AD ASTRA -- REQUEST-AMPLIFICATION REDUCTION: automatic Next.js prefetch
// on protected subject-feature links and the bottom navigation triggers a
// full proxy.ts auth/profile/role chain in the background before the
// teacher ever clicks. Every such link on this page now explicitly opts
// out of prefetch. Navigation itself (href, click behaviour) is
// unchanged -- only the prefetch prop was added.

test("subject feature cards (Classroom, Activity Centre, Live Classroom, Tracker, Activity Review, Learners) all disable prefetch, with their real hrefs unchanged", () => {
  const routeKeys = [
    "teacherClassroom",
    "teacherActivities",
    "teacherLiveClassroom",
    "teacherTracker",
    "teacherReview",
    "teacherLearners",
  ];
  for (const routeKey of routeKeys) {
    const pattern = new RegExp(
      `<Link href=\\{buildSubjectRoute\\(subject, "${routeKey}"\\)\\} prefetch=\\{false\\}>`,
    );
    assert.match(SOURCE, pattern, `expected prefetch={false} on the ${routeKey} link`);
  }
});

test("the 'Back to Subjects' hero link and the bottom navigation (Home, Subjects, Messages, Reports, Profile) all disable prefetch", () => {
  assert.match(
    SOURCE,
    /href="\/teacher\/subjects"\s*\n\s*prefetch=\{false\}\s*\n\s*className="mb-4 flex w-fit items-center gap-2 rounded-full bg-white\/15/,
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

test("regression: no href, route, or query-parameter string on this page changed -- only prefetch was added", () => {
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherClassroom"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherActivities"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherLiveClassroom"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherTracker"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherReview"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "teacherLearners"\)/);
});

test("regression: this prefetch change does not touch authentication -- getAuthenticatedTeacherProfile and getTeacherSubjectSummaryForTeacher are still called exactly as before", () => {
  assert.match(SOURCE, /const teacherProfile = await getAuthenticatedTeacherProfile\(\);/);
  assert.match(
    SOURCE,
    /summary = await getTeacherSubjectSummaryForTeacher\(teacherProfile, subject\.databaseId\);/,
  );
});

// AD ASTRA -- CLOSE TEACHER WRITE DIAGNOSTIC BLIND SPOT: both branches
// that produce "Unable to load the current subject summary." previously
// logged with a bare console.error (summary-fetch branch) or not at all
// (missing-profile branch), with no requestId. Both now log via the
// shared logAuthDiagnostic helper under stage
// "teacher-page.subject-summary", without changing the summaryError text
// or which branch sets it.

test("E: the summary-fetch catch now logs via logAuthDiagnostic (requestId-correlated) instead of a bare console.error", () => {
  assert.doesNotMatch(
    SOURCE,
    /console\.error\(`Unable to load \$\{subject\.displayName\} teacher summary:`/,
  );
  assert.match(
    SOURCE,
    /await logAuthDiagnostic\(\s*\n\s*`Unable to load \$\{subject\.displayName\} teacher summary:`,\s*\n\s*"teacher-page\.subject-summary",\s*\n\s*"summary_fetch_failed",\s*\n\s*error,\s*\n\s*\);/,
  );
});

test("E: the missing-teacher-profile branch now also logs via logAuthDiagnostic under the same stage, distinguished by reason 'teacher_profile_unavailable'", () => {
  assert.match(
    SOURCE,
    /await logAuthDiagnostic\(\s*\n\s*`Unable to load \$\{subject\.displayName\} teacher summary:`,\s*\n\s*"teacher-page\.subject-summary",\s*\n\s*"teacher_profile_unavailable",\s*\n\s*\);/,
  );
});

test("regression: the two logAuthDiagnostic calls sit immediately before their respective (unchanged) summaryError assignment, and the exact-match count of the message is still 2", () => {
  const matches = SOURCE.match(/summaryError = "Unable to load the current subject summary\.";/g) ?? [];
  assert.equal(matches.length, 2);

  const catchBranch = SOURCE.match(
    /catch \(error\) \{[\s\S]*?await logAuthDiagnostic\([\s\S]*?\);[\s\S]*?summaryError = "Unable to load the current subject summary\.";[\s\S]*?\}/,
  );
  assert.ok(catchBranch, "expected logAuthDiagnostic immediately before summaryError in the catch branch");

  const elseBranch = SOURCE.match(
    /\} else \{[\s\S]*?await logAuthDiagnostic\([\s\S]*?\);[\s\S]*?summaryError = "Unable to load the current subject summary\.";[\s\S]*?\}/,
  );
  assert.ok(elseBranch, "expected logAuthDiagnostic immediately before summaryError in the else branch");
});

// AD ASTRA -- TEACHER SUBJECT OVERVIEW DESKTOP ENHANCEMENT: this shared
// component drives all four subject dashboards (Business Studies, English,
// Afrikaans, History), themed entirely through subject.colourTheme and the
// .subject-theme CSS-variable override mechanism below -- no per-subject
// JSX branch exists or was introduced. The mobile max-w-md single-column
// stack is unchanged; at lg: the content column and bottom nav widen to
// lg:max-w-6xl, the stat grid becomes a single row (lg:grid-cols-4), and
// three same-shaped section pairs/triples (Classroom+Activity Management,
// Live Classroom+Tracker+Review, Events+Announcement) group into desktop
// rows via lg:grid lg:grid-cols-{2,3} lg:gap-6 lg:[&>*]:mb-0 wrappers
// (plus lg:mb-6 on each wrapper for row spacing, matching the identical
// fix already shipped on the Teacher Dashboard and Profile pages). The
// Learners card and hero remain untouched, full-width, outside any
// wrapper. This pass also fixes a pre-existing bug: icon-chip backgrounds
// used the literal bg-[#FFF3E6] class, which the subject-theme override
// never targeted, so every subject's icon chips stayed Business-Studies-
// orange-tinted regardless of the glyph's (correctly themed) colour. That
// literal class is now included in the same background-color override
// rule as bg-orange-50/bg-orange-100.

test("A/B: the content wrapper keeps its existing max-w-md and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="max-w-md mx-auto lg:max-w-6xl">/);
});

test("C/D: the stat grid keeps its mobile grid-cols-2 and becomes a single lg:grid-cols-4 row, with no other stray breakpoint", () => {
  assert.match(SOURCE, /<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">/);
  assert.doesNotMatch(SOURCE, /grid-cols-2 gap-3 lg:grid-cols-3/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols/);
});

test("E: Classroom Management and Activity Management are paired using lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0", () => {
  const wrapperStart = SOURCE.indexOf(
    '<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">',
  );
  assert.notEqual(wrapperStart, -1, "expected the Classroom/Activity pairing wrapper to be present");

  const wrapperBlock = SOURCE.slice(wrapperStart, SOURCE.indexOf("Live Classroom"));
  assert.match(wrapperBlock, /Classroom Management/);
  assert.match(wrapperBlock, /Activity Management/);
  const classroomIndex = wrapperBlock.indexOf("Classroom Management");
  const activityIndex = wrapperBlock.indexOf("Activity Management");
  assert.ok(
    classroomIndex > -1 && activityIndex > -1 && classroomIndex < activityIndex,
    "expected Classroom Management to remain before Activity Management (unchanged mobile order)",
  );
});

test("F: Live Classroom, Learning Tracker and Activity Review are grouped using lg:grid lg:grid-cols-3 lg:gap-6", () => {
  const wrapperStart = SOURCE.indexOf(
    '<div className="lg:mb-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:[&>*]:mb-0">',
  );
  assert.notEqual(wrapperStart, -1, "expected the Live Classroom/Tracker/Review grouping wrapper to be present");

  const wrapperBlock = SOURCE.slice(
    wrapperStart,
    SOURCE.indexOf('<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">\n          <TeacherSubjectEventsCard'),
  );
  assert.match(wrapperBlock, /Live Classroom/);
  assert.match(wrapperBlock, /Learning Tracker/);
  assert.match(wrapperBlock, /Activity Review/);
  const liveIndex = wrapperBlock.indexOf("Live Classroom");
  const trackerIndex = wrapperBlock.indexOf("Learning Tracker");
  const reviewIndex = wrapperBlock.indexOf("Activity Review");
  assert.ok(
    liveIndex > -1 && trackerIndex > -1 && reviewIndex > -1 && liveIndex < trackerIndex && trackerIndex < reviewIndex,
    "expected Live Classroom, Learning Tracker, Activity Review to remain in their unchanged mobile order",
  );
  assert.doesNotMatch(SOURCE, /lg:grid-cols-4[\s\S]{0,5}Live Classroom/);
});

test("G: TeacherSubjectEventsCard and TeacherSubjectAnnouncementCard are paired via a parent lg:grid lg:grid-cols-2 lg:gap-6 wrapper, without editing either child component", () => {
  assert.match(
    SOURCE,
    /<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:\[&>\*\]:mb-0">\s*\n\s*<TeacherSubjectEventsCard[\s\S]*?<TeacherSubjectAnnouncementCard[\s\S]*?\/>\s*\n\s*<\/div>/,
  );
});

test("H: the Learners card remains outside every pairing/grouping wrapper, still full-width and link-wrapped", () => {
  const learnersLinkIndex = SOURCE.indexOf(
    '<Link href={buildSubjectRoute(subject, "teacherLearners")} prefetch={false}>',
  );
  assert.notEqual(learnersLinkIndex, -1);

  const eventsWrapperEnd = SOURCE.indexOf(
    "</div>",
    SOURCE.indexOf("<TeacherSubjectAnnouncementCard"),
  );
  assert.ok(
    learnersLinkIndex > eventsWrapperEnd,
    "expected the Learners link to sit after the Events/Announcement wrapper closes, not inside any grid wrapper",
  );

  const learnersSection = SOURCE.slice(learnersLinkIndex, SOURCE.indexOf("</Link>", learnersLinkIndex));
  assert.doesNotMatch(learnersSection, /lg:grid-cols-2|lg:grid-cols-3|lg:grid-cols-4/);
});

test("I/J: the bottom navigation keeps its mobile max-w-md and adds lg:max-w-6xl, matching the content wrapper", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">|<div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">/,
  );
});

test("K: every existing prefetch={false} occurrence is unchanged (hero back-link, 6 subject-feature links, 5 bottom-nav links)", () => {
  const prefetchCount = (SOURCE.match(/prefetch=\{false\}/g) ?? []).length;
  assert.equal(prefetchCount, 12, "expected exactly 12 prefetch={false} occurrences (1 hero + 6 feature links + 5 bottom-nav links)");
});

test("L: the subject-theme CSS override still maps background, text and border classes to --subject-soft / --subject-primary / --subject-border", () => {
  assert.match(SOURCE, /background-color: var\(--subject-soft\) !important;/);
  assert.match(SOURCE, /color: var\(--subject-primary\) !important;/);
  assert.match(SOURCE, /border-color: var\(--subject-border\) !important;/);
});

test("M: the pre-existing bg-[#FFF3E6] icon-chip bug is fixed -- that literal class is now included in the background-color override rule alongside bg-orange-50/bg-orange-100", () => {
  const styleBlockStart = SOURCE.indexOf("<style>{`");
  assert.notEqual(styleBlockStart, -1, "expected the subject-theme <style> block to be present");
  const styleBlock = SOURCE.slice(styleBlockStart, SOURCE.indexOf("`}</style>"));

  const escapedIconChipSelector = ".subject-theme .bg-\\\\[\\\\#FFF3E6\\\\]";
  assert.ok(
    styleBlock.includes(escapedIconChipSelector),
    "expected .subject-theme .bg-\\[\\#FFF3E6\\] to appear in the <style> block",
  );

  const backgroundRuleStart = styleBlock.indexOf(".subject-theme .bg-orange-50");
  const backgroundRuleEnd = styleBlock.indexOf("}", backgroundRuleStart);
  const backgroundRule = styleBlock.slice(backgroundRuleStart, backgroundRuleEnd);
  assert.match(backgroundRule, /\.subject-theme \.bg-orange-100/);
  assert.ok(
    backgroundRule.includes(escapedIconChipSelector),
    "expected the bg-[#FFF3E6] selector to sit in the same rule as bg-orange-50/bg-orange-100, not a separate rule",
  );
  assert.match(backgroundRule, /background-color: var\(--subject-soft\) !important;/);
});

test("N: no per-subject responsive JSX branch was introduced -- the component keeps a single unconditional return with one subject-theme root, and all subject differences remain config-driven", () => {
  assert.doesNotMatch(SOURCE, /subjectKey === "history" \? "lg:|subjectKey === "english" \? "lg:|subjectKey === "afrikaans" \? "lg:/);
  const returnCount = (SOURCE.match(/return \(\s*\n\s*<main/g) ?? []).length;
  assert.equal(returnCount, 1, "expected exactly one return of the <main> element");
});

test("regression: no Tailwind color/background/border utility class was introduced outside the existing subject-theme override targets", () => {
  const wrapperClassNames = SOURCE.match(/className="lg:mb-6 lg:grid lg:grid-cols-\d lg:gap-6 lg:\[&>\*\]:mb-0"/g) ?? [];
  assert.equal(wrapperClassNames.length, 3, "expected exactly 3 desktop grouping wrappers, all purely structural (grid/gap/margin, no color classes)");
  for (const className of wrapperClassNames) {
    assert.doesNotMatch(className, /bg-|text-|border-(?!\[)/);
  }
});
