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
