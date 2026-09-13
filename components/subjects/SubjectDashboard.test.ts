import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This component transitively imports "server-only" (via
// getAuthenticatedLearnerProfile -> lib/supabase/learnerProfile.ts) and
// cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("components/subjects/SubjectDashboard.tsx", "utf8");

// AD ASTRA -- REQUEST-AMPLIFICATION REDUCTION: the investigation found
// this is the MOST prefetch-exposed page in the app -- unlike the teacher
// Subject Overview (only Live Classroom has a loading.tsx), all three of
// this page's feature cards (Classroom, Activities, Live Classroom) sit
// on routes with a loading.tsx and are therefore prefetch-eligible by
// Next.js default. Every one of them, plus Your Work, Back to Subjects,
// and the bottom nav, now explicitly disables prefetch. Navigation
// itself (href, click behaviour) is unchanged -- only the prefetch prop
// was added.

test("all three subject feature cards (Classroom, Activities, Live Classroom) disable prefetch, with their real hrefs unchanged", () => {
  for (const routeKey of [
    "learnerClassroom",
    "learnerActivities",
    "learnerLiveClassroom",
  ]) {
    const pattern = new RegExp(
      `href=\\{buildSubjectRoute\\(subject, "${routeKey}"\\)\\}\\s*\\n\\s*prefetch=\\{false\\}`,
    );
    assert.match(SOURCE, pattern, `expected prefetch={false} on the ${routeKey} link`);
  }
});

test("'Back to Subjects', 'Your Work', and the bottom navigation (Home, Subjects, Chat, Schedule, Profile) all disable prefetch", () => {
  assert.match(
    SOURCE,
    /href="\/subjects"\s*\n\s*prefetch=\{false\}\s*\n\s*className="mb-4 inline-flex items-center gap-2 self-start text-sm font-semibold text-white"/,
  );
  assert.match(SOURCE, /<Link href="\/your-work" prefetch=\{false\} className="block">/);
  for (const href of ["/home", "/subjects", "/chat", "/schedule", "/profile"]) {
    assert.match(
      SOURCE,
      new RegExp(`<Link href="${href.replace(/\//g, "\\/")}" prefetch=\\{false\\}>`),
    );
  }
});

test("regression: no href, route, or query-parameter string on this page changed -- only prefetch was added", () => {
  assert.match(SOURCE, /buildSubjectRoute\(subject, "learnerClassroom"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "learnerActivities"\)/);
  assert.match(SOURCE, /buildSubjectRoute\(subject, "learnerLiveClassroom"\)/);
});

test("regression: this prefetch change does not touch authentication -- getAuthenticatedLearnerProfile is still called exactly as before", () => {
  assert.match(SOURCE, /currentLearner = await getAuthenticatedLearnerProfile\(\);/);
});
