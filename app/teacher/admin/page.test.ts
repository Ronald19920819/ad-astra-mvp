import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via authorizeAdministrator) --
// verified via source inspection, matching this codebase's established
// precedent.

const SOURCE = readFileSync("app/teacher/admin/page.tsx", "utf8");

test("authorises via the canonical authorizeAdministrator() helper -- never a bespoke/duplicated admin check", () => {
  assert.match(
    SOURCE,
    /import \{ authorizeAdministrator \} from "@\/lib\/supabase\/teacherAuth";/,
  );
  assert.match(SOURCE, /const authorization = await authorizeAdministrator\(\);/);
});

test("an unauthorised caller (or a non-admin teacher) gets notFound(), matching the existing security convention -- never a distinct 'Access Denied' page that would confirm the route exists", () => {
  assert.match(SOURCE, /if \(!authorization\.success\) \{\s*\n\s*notFound\(\);/);
});

test("authorization happens before anything else is rendered or fetched", () => {
  const authIndex = SOURCE.indexOf("await authorizeAdministrator()");
  const renderIndex = SOURCE.indexOf("<main");
  assert.ok(authIndex > -1 && renderIndex > -1 && authIndex < renderIndex);
});

test("the Coin Management card links to /teacher/admin/coins with the exact required description", () => {
  assert.match(SOURCE, /title="Coin Management"/);
  assert.match(
    SOURCE,
    /description="View learner Ad Astra Coin balances and transaction history\."/,
  );
  assert.match(SOURCE, /href="\/teacher\/admin\/coins"/);
});

test("the Learner Subject Management card links to the existing enrolment-management location without relocating it", () => {
  assert.match(SOURCE, /title="Learner Subject Management"/);
  assert.match(SOURCE, /description="Manage learner subject and class enrolments\."/);
  assert.match(SOURCE, /href="\/teacher\/subjects"/);
});

test("this hub contains no Coin write/adjustment action of any kind -- Stage 1 is read-only", () => {
  assert.doesNotMatch(SOURCE, /Add Coins|Subtract Coins|Adjust|adjustment/i);
});

test("is not nested under any subject-specific navigation -- a platform-level route, not a per-subject one", () => {
  assert.doesNotMatch(SOURCE, /subjectKey|getSubjectConfiguration\(/);
});

// AD ASTRA ADMINISTRATOR NAVIGATION: deterministic back-navigation to the
// canonical Teacher Profile route, above the existing eyebrow/title area.
// A plain Link, never router.back()/history.back(), so the destination is
// always known regardless of how the teacher arrived at this page.

test("a 'Back to Teacher Profile' link points directly to the canonical /teacher/profile route, with prefetch disabled per the request-amplification-reduction policy", () => {
  assert.match(
    SOURCE,
    /<Link\s*\n\s*href="\/teacher\/profile"\s*\n\s*prefetch=\{false\}\s*\n\s*className="mb-2 inline-block text-sm font-semibold text-\[#508DB1\]"\s*\n\s*>\s*\n\s*← Back to Teacher Profile/,
  );
});

test("the back link is never router.back()/history.back() -- it is a deterministic destination", () => {
  assert.doesNotMatch(SOURCE, /router\.back\(\)|history\.back\(\)|window\.history\.back\(\)/);
});

test("the back link is rendered above the existing 'Administrator' eyebrow, not replacing or relocating it", () => {
  const backLinkIndex = SOURCE.indexOf('href="/teacher/profile"');
  const eyebrowIndex = SOURCE.indexOf('text-xs font-bold uppercase tracking-[0.3em] text-[#508DB1]');
  assert.ok(backLinkIndex > -1 && eyebrowIndex > -1 && backLinkIndex < eyebrowIndex);
  assert.match(SOURCE, /Administrator\s*\n\s*<\/p>/);
});
