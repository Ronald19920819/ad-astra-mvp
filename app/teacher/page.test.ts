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
