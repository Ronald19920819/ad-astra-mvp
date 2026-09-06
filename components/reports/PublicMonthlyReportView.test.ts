import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports next/font/local (via MonthlyReportGenerator.tsx)
// and next/image, which only resolve inside a real Next.js build -- per
// this codebase's established precedent (see
// MonthlyReportFinaliseStatus.tsx's own header comment on why that
// component was extracted specifically to avoid this), this component is
// verified via source inspection rather than a direct render here.

const SOURCE = readFileSync("components/reports/PublicMonthlyReportView.tsx", "utf8");

test("exposes no teacher controls -- no editing, regeneration, finalisation, selection, or recipient/link actions", () => {
  assert.doesNotMatch(
    SOURCE,
    /onClick|useState|useEffect|fetch\(|Finalise|Regenerate|Send Report|Disable Report Link|Copy Report Link/,
  );
});

test("takes only the frozen report snapshot and resolved commentary as props -- it fetches nothing itself", () => {
  assert.match(
    SOURCE,
    /export function PublicMonthlyReportView\(\{\s*\n\s*report,\s*\n\s*comments,\s*\n\s*\}: \{\s*\n\s*report: MonthlyReportPayload;\s*\n\s*comments: KingdomMonthlyReportComments \| null;\s*\n\s*\}\)/,
  );
});

test("never imports any teacher-authentication, share, or delivery module -- it cannot reach any data beyond what it was handed", () => {
  assert.doesNotMatch(SOURCE, /teacherAuth|ShareRepository|DeliveryRepository|sendEmail/);
});

test("labels the commentary section as approved/finalised, not as a draft awaiting review", () => {
  assert.match(SOURCE, /Approved Commentary/);
});

test("carries an explicit read-only, no-login note for the recipient", () => {
  assert.match(SOURCE, /read-only view of a finalised AD Astra progress report/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
// Root cause: a Server Component importing plain values/functions from a
// "use client" module (MonthlyReportGenerator.tsx) gets an opaque client
// reference, not the real implementation -- BADGE_ASSET_BY_KEY indexed on
// the server silently resolved to undefined. Fixed by rendering this view
// as a Client Component itself (its props are plain, serializable JSON),
// putting every reused import on the same side of the boundary as its
// source module.
test("is rendered as a Client Component -- required for its reused imports from the 'use client' MonthlyReportGenerator.tsx module to actually work rather than resolve to opaque/undefined references", () => {
  assert.match(SOURCE, /^"use client";/);
});

test("resolves the badge through the canonical resolver, never a direct BADGE_ASSET_BY_KEY lookup", () => {
  assert.match(
    SOURCE,
    /import \{ resolveMonthlyReportBadgeAsset \} from "@\/lib\/reports\/monthlyReportBadgeAsset";/,
  );
  assert.match(SOURCE, /resolveMonthlyReportBadgeAsset\(report\.badge\?\.key\)/);
  assert.doesNotMatch(SOURCE, /BADGE_ASSET_BY_KEY/);
});

test("an unresolved (null) badge never crashes this page -- the badge image and label both render a safe fallback instead", () => {
  assert.match(SOURCE, /\{badge \? \(/);
  assert.match(SOURCE, /value=\{badge\?\.label \?\? "Not Available"\}/);
});
