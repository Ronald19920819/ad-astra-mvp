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
