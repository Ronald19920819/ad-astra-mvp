import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This page is a plain "use client" component with no server-only data
// dependency -- unlike app/teacher/page.tsx and app/teacher/subjects/page.tsx,
// it could in principle be imported directly, but this file follows the
// same established source-inspection convention regardless (see
// app/teacher/page.test.ts, app/teacher/subjects/page.test.ts), since the
// page's JSX is prototype/local-state markup that is more reliably and
// precisely verified as source text than through a React render harness
// this codebase does not otherwise use.

const SOURCE = readFileSync("app/teacher/messages/page.tsx", "utf8");

// AD ASTRA -- TEACHER MESSAGES DESKTOP ENHANCEMENT: the inbox page's
// existing max-w-3xl content column and bottom nav now widen to
// lg:max-w-6xl at desktop, matching the Teacher Dashboard and (locally
// approved, uncommitted) Teacher Subjects pattern. The learner chat card
// stack becomes a two-column grid at lg:. This page has no real backend
// (confirmed by investigation: no Supabase, no API route, no realtime,
// hardcoded cards, local-state-only announcement) -- this pass is
// presentation-only and does not attempt to fix any of that.

test("A: the inbox content wrapper keeps its existing max-w-3xl and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="mx-auto max-w-3xl lg:max-w-6xl">/);
});

test("B: the learner chat list keeps its mobile vertical stack (space-y-6) by default", () => {
  assert.match(SOURCE, /className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0"/);
});

test("C: the learner chat list becomes a two-column grid at lg: (not three)", () => {
  assert.match(SOURCE, /lg:grid-cols-2/);
  assert.doesNotMatch(SOURCE, /lg:grid-cols-3/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols/);
});

test("D: the desktop grid resets mobile vertical spacing (lg:space-y-0) in favour of its own lg:gap-6, and the second card's own mt-5 is neutralised at lg: so it aligns with the first card in the grid row", () => {
  const spaceY0Count = (SOURCE.match(/lg:space-y-0/g) ?? []).length;
  assert.equal(spaceY0Count, 1, "expected lg:space-y-0 exactly once, on the learner chat list");

  const gap6Count = (SOURCE.match(/lg:gap-6/g) ?? []).length;
  assert.equal(gap6Count, 1, "expected lg:gap-6 exactly once, on the learner chat list");

  assert.match(SOURCE, /className="mt-5 lg:mt-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"/);
});

test("E: the bottom navigation reconciles its previous max-w-md mismatch to max-w-3xl and adds lg:max-w-6xl, matching the page's own content width", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-3xl grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">/,
  );
  assert.doesNotMatch(SOURCE, /max-w-md/);
});

test("F: prefetch={false} remains present on all five bottom navigation destinations", () => {
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

test("regression: the learner-chat-card link destination and both cards' content are unchanged", () => {
  assert.match(SOURCE, /<Link href="\/teacher\/messages\/danielle-coetzee">/);
  assert.match(SOURCE, /Business Studies • New message/);
  assert.match(SOURCE, /History • Yesterday/);
  assert.match(SOURCE, /Sir, can you please explain the case study question again\?/);
  assert.match(SOURCE, /I uploaded my activity late, please check if it came through\./);
});

test("regression: the second ('History') card is still not wrapped in a Link -- its pre-existing inert state is unchanged by this pass, not fixed", () => {
  const cardsBlock = SOURCE.slice(
    SOURCE.indexOf('className="space-y-6 lg:grid'),
    SOURCE.indexOf("</section>"),
  );
  const linkCount = (cardsBlock.match(/<Link /g) ?? []).length;
  assert.equal(linkCount, 1, "expected exactly one Link inside the learner chat list (the first card only)");
});

test("regression: Announce to Class keeps its existing local-state-only behaviour -- sendAnnouncement, the textarea, and the button are unchanged", () => {
  assert.match(SOURCE, /function sendAnnouncement\(\) \{/);
  assert.match(SOURCE, /setAnnouncements\(\(previous\) => \[/);
  assert.match(SOURCE, /placeholder="Write an announcement for Business Studies\.\.\."/);
  assert.match(SOURCE, /Send to Whole Class/);
  assert.doesNotMatch(SOURCE, /fetch\(/);
  assert.doesNotMatch(SOURCE, /supabase/i);
});

test("regression: the hero's 190px height, imagery, heading, and AuthenticatedTeacherName usage are unchanged", () => {
  assert.match(SOURCE, /height: "190px"/);
  assert.match(SOURCE, /Learner Chats/);
  assert.match(SOURCE, /<AuthenticatedTeacherName \/> • Talk to your learners\./);
  assert.match(SOURCE, /backgroundImage: "url\('\/hero-banner-2\.png'\)"/);
});
