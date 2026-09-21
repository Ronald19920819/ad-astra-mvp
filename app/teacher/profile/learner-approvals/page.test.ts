import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" page with no server-only dependency -- follows the same
// established source-inspection convention as every other page in this
// desktop pass (app/teacher/page.test.ts, app/teacher/subjects/page.test.ts,
// app/teacher/messages/page.test.ts, app/teacher/profile/page.test.ts),
// since the responsive architecture is more reliably and precisely
// verified as source text than through a React render harness this
// codebase does not otherwise use.

const SOURCE = readFileSync(
  "app/teacher/profile/learner-approvals/page.tsx",
  "utf8",
);

// AD ASTRA -- LEARNER APPROVALS DESKTOP ENHANCEMENT: the page's existing
// max-w-2xl content column now widens to lg:max-w-6xl at desktop, and the
// single-column pending-request stack becomes a two-column grid at lg:,
// following the same lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 pattern
// already shipped on Teacher Subjects/Messages. No approval logic, API
// call, card content, or navigation changed.

test("A/B: the content wrapper keeps its existing max-w-2xl base and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="mx-auto max-w-2xl lg:max-w-6xl">/);
});

test("C/D: the pending-request collection keeps its mobile vertical stack (space-y-4) by default and becomes a two-column grid (lg:grid-cols-2, not three) at lg:, with mobile spacing reset in favour of lg:gap-6", () => {
  assert.match(
    SOURCE,
    /className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0"/,
  );
  assert.doesNotMatch(SOURCE, /lg:grid-cols-3/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols/);
});

test("E: each individual request's information grid keeps its existing sm:grid-cols-2 treatment, unchanged by the outer desktop grid", () => {
  assert.match(SOURCE, /<dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">/);
});

test("F/G: the back link to Teacher Profile remains a deterministic Link, not router.back()", () => {
  assert.match(SOURCE, /<Link\s*\n\s*href="\/teacher\/profile"/);
  assert.doesNotMatch(SOURCE, /router\.back\(\)/);
});

test("H: the existing learner-approvals API route is still referenced for both loading and reviewing requests", () => {
  assert.match(SOURCE, /fetch\("\/api\/teacher\/learner-approvals", \{ cache: "no-store" \}\)/);
  assert.match(SOURCE, /fetch\(\s*\n\s*`\/api\/teacher\/learner-approvals\/\$\{requestId\}`,/);
});

test("regression: reviewRequest's method, headers, and request body are unchanged", () => {
  assert.match(SOURCE, /method: "PATCH",/);
  assert.match(SOURCE, /headers: \{ "Content-Type": "application\/json" \},/);
  assert.match(SOURCE, /body: JSON\.stringify\(\{ action \}\),/);
});

test("regression: Approve and Decline buttons keep their existing actions, icons, and disabled/loading behaviour", () => {
  assert.match(SOURCE, /void reviewRequest\(request\.id, "approve"\)/);
  assert.match(SOURCE, /void reviewRequest\(request\.id, "decline"\)/);
  assert.match(SOURCE, /disabled=\{isReviewing\}/);
});

test("regression: empty, loading, and error state text is unchanged", () => {
  assert.match(SOURCE, /No learner approval requests are waiting\./);
  assert.match(SOURCE, /Loading learner approval requests\.\.\./);
  assert.match(SOURCE, /Unable to load learner approval requests\./);
  assert.match(SOURCE, /Unable to review this request\./);
});

test("regression: no standard Teacher bottom navigation was added -- this remains a back-link-only detail page", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});
