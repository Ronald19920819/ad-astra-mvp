import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" page importing next/font/google -- verified via source
// inspection, matching this codebase's established precedent for such
// components.

const SOURCE = readFileSync("app/teacher/profile/page.tsx", "utf8");

// AD ASTRA ADMINISTRATOR HUB -- STAGE 1.

test("the Administrator entry is only ever rendered when profile.isAdministrator is true -- an ordinary teacher's profile never includes this link", () => {
  assert.match(SOURCE, /\{profile\?\.isAdministrator \? \(/);
  const guardedBlock = SOURCE.match(/\{profile\?\.isAdministrator \? \([\s\S]*?\n\s*\) : null\}/)?.[0];
  assert.ok(guardedBlock, "Administrator conditional block not found");
  assert.match(guardedBlock!, /href="\/teacher\/admin"/);
  assert.match(guardedBlock!, />\s*Administrator\s*</);
});

test("hiding the link is a UX convenience only -- this page does not claim that alone is sufficient security (the comment documents that /teacher/admin re-checks authorization independently)", () => {
  assert.match(SOURCE, /independently\s*\n\s*re-checks authorizeAdministrator\(\) server-side/);
});

test("isAdministrator is read from the server-resolved profile dashboard, never a client-side/local flag", () => {
  assert.match(SOURCE, /const \{ dashboard, isLoading \} = useAuthenticatedTeacherProfile\(\);/);
  assert.match(SOURCE, /const profile = dashboard\?\.profile \?\? null;/);
});

test("is not gated on a hardcoded email or name", () => {
  assert.doesNotMatch(SOURCE, /profile\?\.email ===|@ad-astra|=== "admin"/i);
});

// AD ASTRA -- TEACHER PROFILE DESKTOP ENHANCEMENT: the page's mobile-only
// max-w-md content column and bottom nav now widen at lg:, following the
// same pattern already shipped on the Teacher Dashboard and (locally
// approved, uncommitted) Teacher Subjects/Messages. Teacher Information
// and Teaching Overview -- the two comparably-sized "fact sheet" cards --
// pair into a two-column grid at lg: using the Dashboard's exact
// lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0 wrapper; AD Astra Coins,
// Settings, and the identity header all remain full-width/centred,
// unchanged. No content, copy, data-fetching, or Administrator
// gating/authorization changed.

test("A: the content wrapper keeps its mobile max-w-md and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="max-w-md mx-auto lg:max-w-6xl">/);
});

test("B: Teacher Information and Teaching Overview are paired using the established lg two-column wrapper (with its added lg:mb-6 row gap before AD Astra Coins)", () => {
  const wrapperStart = SOURCE.indexOf(
    '<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">',
  );
  assert.notEqual(wrapperStart, -1, "expected the lg two-column wrapper to be present");

  const wrapperBlock = SOURCE.slice(wrapperStart, SOURCE.indexOf("AD Astra Coins"));
  assert.match(wrapperBlock, /Teacher Information/);
  assert.match(wrapperBlock, /Teaching Overview/);
  const infoIndex = wrapperBlock.indexOf("Teacher Information");
  const overviewIndex = wrapperBlock.indexOf("Teaching Overview");
  assert.ok(
    infoIndex > -1 && overviewIndex > -1 && infoIndex < overviewIndex,
    "expected Teacher Information to remain before Teaching Overview (unchanged mobile order)",
  );
});

test("C: each paired section keeps its own mobile mb-5, and the wrapper resets that margin only at lg: (lg:[&>*]:mb-0), exactly once", () => {
  const mb5Count = (
    SOURCE.match(/<section className="mb-5 rounded-\[2rem\] border border-blue-100 bg-white p-5 shadow-sm">/g) ?? []
  ).length;
  assert.equal(mb5Count, 2, "expected both Teacher Information and Teaching Overview to keep mb-5");

  const resetCount = (SOURCE.match(/lg:\[&>\*\]:mb-0/g) ?? []).length;
  assert.equal(resetCount, 1, "expected the lg:[&>*]:mb-0 margin reset exactly once, on the pairing wrapper");
});

// AD ASTRA -- DESKTOP SPACING ADJUSTMENT: the Teacher Information/Teaching
// Overview pairing wrapper's own children have their mobile margin reset
// at lg: (lg:[&>*]:mb-0), which left the two-column row touching AD Astra
// Coins immediately below it on desktop, with no gap at all. The wrapper
// now also carries lg:mb-6 (24px, matching the identical fix already
// applied to app/teacher/page.tsx's analogous Row 1) so the row has
// deliberate breathing room before Coins on desktop. The horizontal
// lg:gap-6 between Teacher Information and Teaching Overview, and all
// mobile spacing, are unchanged.

test("Row spacing: the pairing wrapper adds a 24px desktop-only bottom margin (lg:mb-6) before AD Astra Coins, without touching the horizontal lg:gap-6 or mobile spacing", () => {
  assert.match(
    SOURCE,
    /<div className="lg:mb-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:\[&>\*\]:mb-0">/,
  );

  const mb6Count = (SOURCE.match(/lg:mb-6/g) ?? []).length;
  assert.equal(mb6Count, 1, "expected lg:mb-6 to appear exactly once, on the pairing wrapper");

  const gap6Count = (SOURCE.match(/lg:gap-6/g) ?? []).length;
  assert.equal(gap6Count, 1, "expected the horizontal lg:gap-6 to remain exactly once, unchanged");
});

test("D: the fixed bottom navigation widens in lockstep with the content wrapper (max-w-md ... lg:max-w-6xl)", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm {2}text-black lg:max-w-6xl">/,
  );
});

test("E/F: the Administrator link remains conditional on profile?.isAdministrator and its href remains /teacher/admin -- untouched by the layout change", () => {
  assert.match(SOURCE, /\{profile\?\.isAdministrator \? \(/);
  const guardedBlock = SOURCE.match(/\{profile\?\.isAdministrator \? \([\s\S]*?\n\s*\) : null\}/)?.[0];
  assert.ok(guardedBlock, "Administrator conditional block not found");
  assert.match(guardedBlock!, /href="\/teacher\/admin"/);
});

test("G: prefetch={false} remains present on every bottom navigation link and on the Administrator/Learner Approvals settings links", () => {
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
  assert.match(
    SOURCE,
    /href="\/teacher\/admin"\s*\n\s*prefetch=\{false\}/,
  );
  assert.match(
    SOURCE,
    /href="\/teacher\/profile\/learner-approvals"\s*\n\s*prefetch=\{false\}/,
  );
});

test("regression: AD Astra Coins and Settings remain full-width sections, outside the two-column pairing wrapper", () => {
  const coinsSectionIndex = SOURCE.indexOf(
    '<section className="mb-5 rounded-[2rem] border border-yellow-200',
  );
  const settingsSectionIndex = SOURCE.indexOf(
    '<section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">\r\n          <div className="mb-3 flex items-center gap-3">\r\n            <Settings',
  );
  const pairingWrapperIndex = SOURCE.indexOf(
    '<div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:[&>*]:mb-0">',
  );
  const pairingWrapperCloseIndex = SOURCE.indexOf(
    "</div>",
    SOURCE.indexOf("Teaching Overview"),
  );

  assert.ok(coinsSectionIndex > -1, "AD Astra Coins section not found");
  assert.ok(settingsSectionIndex > -1, "Settings section not found");
  assert.ok(
    coinsSectionIndex > pairingWrapperCloseIndex &&
      coinsSectionIndex > pairingWrapperIndex,
    "expected AD Astra Coins to sit after the two-column pairing wrapper closes, not inside it",
  );
  assert.ok(
    settingsSectionIndex > coinsSectionIndex,
    "expected Settings to remain after AD Astra Coins, both full-width",
  );
});

test("regression: the identity header keeps its centred layout and every existing element (logo, wordmark, name, subtitle, avatar, decorative Edit badge, script typography)", () => {
  assert.match(SOURCE, /<section className="flex flex-col items-center text-center mb-6">/);
  assert.match(SOURCE, /shadowsIntoLight\.className/);
  assert.match(SOURCE, /<ProfileAvatar profile=\{profile\} role="Teacher" \/>/);
  assert.match(
    SOURCE,
    /<div className="absolute bottom-1 right-1 rounded-full bg-\[#102A43\] px-3 py-1 text-xs font-semibold text-white shadow-sm">\s*\n\s*Edit\s*\n\s*<\/div>/,
  );
  assert.doesNotMatch(SOURCE, /lg:max-w-xl/);
});

test("regression: profile/teaching-overview data hooks and prototype Settings notices are unchanged", () => {
  assert.match(SOURCE, /const \{ dashboard, isLoading \} = useAuthenticatedTeacherProfile\(\);/);
  assert.match(SOURCE, /const overview = dashboard\?\.teachingOverview \?\? null;/);
  assert.match(SOURCE, /"Subscription plans are not available yet\."/);
  assert.match(SOURCE, /"Subject enrolment management is coming in a later phase\."/);
  assert.match(SOURCE, /"Content archiving is coming in the next content phase\."/);
});
