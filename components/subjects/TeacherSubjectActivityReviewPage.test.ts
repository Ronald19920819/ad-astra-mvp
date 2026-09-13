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
