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

// AD ASTRA -- LIBRARY CLUB (STAGE B) DASHBOARD ENTRANCE: a single new
// section, added once to this shared SubjectDashboard component (used by
// all 8 subject variants, per BusinessStudiesDashboard/EnglishDashboard/
// AfrikaansDashboard/HistoryDashboard's identical wrapper pages), after
// the existing "Your Work" card and before the bottom navigation. No
// existing section, card, or data fetch was touched.

test("1/4: the 'AD Astra -- Library Club' entrance links to /library/${subject.key}, the exact canonical subjectKey, not a display name", () => {
  assert.match(SOURCE, /AD Astra &ndash; Library Club/);
  assert.match(SOURCE, /href=\{`\/library\/\$\{subject\.key\}`\}/);
});

test("2: the entrance is added once to the shared SubjectDashboard component -- not duplicated per subject variant", () => {
  const occurrences = (SOURCE.match(/AD Astra &ndash; Library Club/g) ?? []).length;
  assert.equal(occurrences, 1, "expected the Library Club heading exactly once in this shared component");
});

test("5: the Library Club entrance link disables prefetch, matching the established learner-navigation convention", () => {
  assert.match(
    SOURCE,
    /<Link href=\{`\/library\/\$\{subject\.key\}`\} prefetch=\{false\}>/,
  );
});

test("6: the entrance reuses the existing subject colour theme variables -- no new hardcoded colour system was introduced", () => {
  const entranceStart = SOURCE.indexOf("AD Astra &ndash; Library Club");
  const entranceEnd = SOURCE.indexOf("</section>", entranceStart);
  const entranceBlock = SOURCE.slice(entranceStart - 400, entranceEnd);
  assert.match(entranceBlock, /var\(--subject-soft\)/);
  assert.match(entranceBlock, /var\(--subject-primary\)/);
  assert.doesNotMatch(entranceBlock, /#F97316|#2563EB|#EB2525|#3AAA35/);
});

test("7: the entrance introduces no progress/XP/Coin/due-date language", () => {
  const entranceStart = SOURCE.indexOf("AD Astra &ndash; Library Club");
  const entranceEnd = SOURCE.indexOf("</section>", entranceStart);
  const entranceBlock = SOURCE.slice(entranceStart - 200, entranceEnd);
  assert.doesNotMatch(entranceBlock, /XP|Coin|progress|completion|due date|overdue|mark/i);
});

test("8: existing dashboard content (Learning Overview, Live Classroom, Classroom, Activities, Your Work) remains present, before the new entrance", () => {
  assert.match(SOURCE, /Learning Overview/);
  assert.match(SOURCE, /Live Classroom/);
  assert.match(SOURCE, />\s*Classroom\s*</);
  assert.match(SOURCE, />\s*Activities\s*</);
  assert.match(SOURCE, /Your Work/);
  const yourWorkIndex = SOURCE.indexOf("Your Work");
  const libraryClubIndex = SOURCE.indexOf("AD Astra &ndash; Library Club");
  assert.ok(yourWorkIndex > -1 && libraryClubIndex > -1);
  assert.ok(yourWorkIndex < libraryClubIndex, "expected the Library Club entrance after Your Work");
});

test("the entrance sits after the content wrapper's existing sections and before the bottom navigation", () => {
  const libraryClubIndex = SOURCE.indexOf("AD Astra &ndash; Library Club");
  const navIndex = SOURCE.indexOf("<nav");
  assert.ok(libraryClubIndex > -1 && navIndex > -1);
  assert.ok(libraryClubIndex < navIndex, "expected the Library Club entrance before the bottom nav");
});
