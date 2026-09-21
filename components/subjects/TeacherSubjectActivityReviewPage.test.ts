import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This component transitively imports "server-only" (via
// getSubjectActivityReviews -> authorizeTeacher -> lib/supabase/server.ts)
// and cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("components/subjects/TeacherSubjectActivityReviewPage.tsx", "utf8");

// AD ASTRA -- REQUEST-AMPLIFICATION REDUCTION: Activity Review's own
// "Back to Overview" link and its bottom navigation are protected
// navigation that can trigger a background proxy.ts auth/profile/role
// cycle via Next.js prefetch. Both now explicitly disable prefetch.
// Navigation itself (href, click behaviour) is unchanged.

test("the 'Back to Overview' link disables prefetch, with its real href unchanged", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "teacherOverview"\)\}\s*\n\s*prefetch=\{false\}/,
  );
});

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

test("regression: this prefetch change does not touch authorization -- getSubjectActivityReviews (authorizeTeacher-backed) is still called exactly as before, and the same error message is shown on failure", () => {
  assert.match(
    SOURCE,
    /activities = await getSubjectActivityReviews\(subject\.databaseId\);/,
  );
  assert.match(
    SOURCE,
    /loadError = "Unable to load activity reviews\. Please try again\.";/,
  );
});

// AD ASTRA -- ACTIVITY REVIEW QUEUE DESKTOP ENHANCEMENT + OPEN-SUBMISSION
// PREFETCH SAFEGUARD: the outer content column and bottom nav widen to
// lg:max-w-6xl at desktop, giving the existing ReviewRows sm:grid 5-column
// row layout more room to breathe -- ReviewRows itself is untouched, still
// switching between its sm:hidden mobile-card variant and its hidden
// sm:grid desktop/tablet row variant at the same sm: breakpoint as before.
// Activity accordions remain native <details>/<summary>, full-width, one
// per row, never paired into a grid. Separately, both existing "Open"
// submission links (the row variant and the mobile-card variant) now
// disable prefetch, matching the prefetch-disable convention already
// applied to every other Teacher navigation link -- their href,
// buildSubjectDetailRoute() call and destination are unchanged.

test("A/B: the outer content wrapper keeps its existing max-w-3xl and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto max-w-3xl px-4 pt-4 lg:max-w-6xl">/,
  );
});

test("C/D/E: ReviewRows keeps its existing sm:grid desktop/tablet variant, its sm:hidden mobile variant, and the exact five-column grid template, unchanged", () => {
  const smGridCount = (
    SOURCE.match(
      /hidden grid-cols-\[minmax\(0,1\.5fr\)_0\.9fr_1fr_1fr_auto\] items-center gap-3[^"]*sm:grid/g,
    ) ?? []
  ).length;
  assert.equal(smGridCount, 2, "expected the five-column sm:grid template on both the header row and each learner row");

  const smHiddenCount = (SOURCE.match(/sm:hidden/g) ?? []).length;
  assert.equal(smHiddenCount, 1, "expected exactly one sm:hidden mobile-card variant");
});

test("F: no lg:grid-cols-* restructuring was introduced into ReviewRows -- the only new breakpoint classes in the file are the lg:max-w-6xl width additions", () => {
  assert.doesNotMatch(SOURCE, /lg:grid-cols/);
  assert.doesNotMatch(SOURCE, /lg:grid\b/);
});

test("G: the activity list remains built from native <details>/<summary>, one per activity, never paired side by side", () => {
  assert.match(SOURCE, /<details\s*\n\s*key=\{activity\.id\}/);
  assert.match(SOURCE, /<summary className="flex w-full cursor-pointer list-none/);
  assert.doesNotMatch(SOURCE, /lg:grid-cols-2[\s\S]{0,80}<details/);
});

test("H/I: both 'Open' submission links still use buildSubjectDetailRoute(subject, \"teacherReview\", learner.submission.id) and now also disable prefetch", () => {
  const openLinkPattern =
    /href=\{buildSubjectDetailRoute\(\s*\n\s*subject,\s*\n\s*"teacherReview",\s*\n\s*learner\.submission\.id,\s*\n\s*\)\}\s*\n\s*prefetch=\{false\}/g;
  const matches = SOURCE.match(openLinkPattern) ?? [];
  assert.equal(matches.length, 2, "expected both the row-variant and mobile-card-variant Open links to have prefetch={false}");
});

test("J: the hero 'Back to Dashboard' link retains prefetch={false}", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "teacherOverview"\)\}\s*\n\s*prefetch=\{false\}/,
  );
});

test("K/L/M: the bottom navigation keeps its mobile max-w-md base, adds lg:max-w-6xl, and all five destinations keep prefetch={false}", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">/,
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

test("N/O: the subject-theme CSS-variable system and its four orange override selector groups remain intact", () => {
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
  assert.match(SOURCE, /"--subject-soft": subject\.colourTheme\.softBackground,/);
  assert.match(SOURCE, /"--subject-border": subject\.colourTheme\.border,/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-500 \{/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-50 \{/);
  assert.match(SOURCE, /\.subject-theme \.text-orange-500 \{/);
  assert.match(SOURCE, /\.subject-theme \.border-orange-100 \{/);
});

test("P: getSubjectActivityReviews remains referenced with its subject.databaseId argument unchanged", () => {
  assert.match(
    SOURCE,
    /activities = await getSubjectActivityReviews\(subject\.databaseId\);/,
  );
});

test("Q/R: loadError and empty-state wording remain exactly as before", () => {
  assert.match(
    SOURCE,
    /loadError = "Unable to load activity reviews\. Please try again\.";/,
  );
  assert.match(SOURCE, /No published activities available\./);
  assert.match(SOURCE, /No learners to review for this activity\./);
});

test("S: no two-column activity grid or preview-pane architecture was introduced", () => {
  assert.doesNotMatch(SOURCE, /grid-cols-2[\s\S]{0,40}activityGroups/);
  assert.doesNotMatch(SOURCE, /preview/i);
  assert.doesNotMatch(SOURCE, /split-screen/i);
});

test("regression: status labels, mark labels, and badge colour logic are all unchanged", () => {
  assert.match(SOURCE, /"Submitted"/);
  assert.match(SOURCE, /"Awaiting Review"/);
  assert.match(SOURCE, /"Returned"/);
  assert.match(SOURCE, /"Marking Failed"/);
  assert.match(SOURCE, /"Not Submitted"/);
  assert.match(SOURCE, /"No draft"/);
  assert.match(SOURCE, /"Pending"/);
  assert.doesNotMatch(SOURCE, /"Late"|"AI Marked"|"Teacher Reviewed"/);
});
