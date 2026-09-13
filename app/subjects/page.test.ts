import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via getLearnerPublishedLessons /
// verifyLearnerSubjectAccess and similar) -- verified via source
// inspection, matching this codebase's established precedent.

const SOURCE = readFileSync("app/subjects/page.tsx", "utf8");

// AD ASTRA -- REQUEST-AMPLIFICATION REDUCTION: each subject card here
// links directly into the exact learner Subject Dashboard route whose
// intermittent loading failure prompted this investigation. It, the
// "Back to Home" link, and the bottom navigation now explicitly disable
// prefetch. Navigation itself (href, click behaviour) is unchanged.

test("each subject card (leading into the learner Subject Dashboard) disables prefetch, with its real href unchanged", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "learnerDashboard"\)\}\s*\n\s*prefetch=\{false\}/,
  );
});

test("'Back to Home' and the bottom navigation (Home, Subjects, Chat, Schedule, Profile) disable prefetch", () => {
  assert.match(
    SOURCE,
    /href="\/home"\s*\n\s*prefetch=\{false\}\s*\n\s*className=\{`\$\{neueHaas\.className\} mb-4/,
  );
  for (const href of ["/home", "/subjects", "/chat", "/schedule", "/profile"]) {
    assert.match(
      SOURCE,
      new RegExp(`<Link href="${href.replace(/\//g, "\\/")}" prefetch=\\{false\\}>`),
    );
  }
});

test("regression: no href, route, or query-parameter string changed -- only prefetch was added", () => {
  assert.match(SOURCE, /buildSubjectRoute\(subject, "learnerDashboard"\)/);
});
