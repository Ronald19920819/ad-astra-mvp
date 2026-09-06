import assert from "node:assert/strict";
import test from "node:test";
import * as monthlyReportBadgeAssetModule from "./monthlyReportBadgeAsset";
import { resolveMonthlyReportBadgeAsset } from "./monthlyReportBadgeAsset";

// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
// This module has no "use client", no next/font, no next/image, and no
// "server-only" -- unlike the components that consume it, it can be
// imported and exercised directly here with real assertions rather than
// source inspection.

test("resolves the real Stellar frozen badge key to its correct asset", () => {
  const asset = resolveMonthlyReportBadgeAsset("stellar");
  assert.deepEqual(asset, {
    src: "/badges/performance/stellar.png",
    alt: "Stellar performance badge",
    label: "Stellar",
  });
});

test("resolves the real On Course frozen badge key to its correct asset", () => {
  const asset = resolveMonthlyReportBadgeAsset("on_course");
  assert.deepEqual(asset, {
    src: "/badges/performance/on-course.png",
    alt: "On Course performance badge",
    label: "On Course",
  });
});

test("resolves the real Course Correction frozen badge key to its correct asset -- the exact key observed in the finalised reports that crashed the public route", () => {
  const asset = resolveMonthlyReportBadgeAsset("course_correction");
  assert.deepEqual(asset, {
    src: "/badges/performance/course-correction.png",
    alt: "Course Correction performance badge",
    label: "Course Correction",
  });
});

test("returns null (never throws) for an unrecognised/legacy badge key, rather than crashing the caller", () => {
  assert.doesNotThrow(() => resolveMonthlyReportBadgeAsset("legacy-course-correction"));
  assert.equal(resolveMonthlyReportBadgeAsset("legacy-course-correction"), null);
});

test("returns null for every non-string input a frozen jsonb blob could plausibly contain -- undefined, null, an object, a number", () => {
  assert.equal(resolveMonthlyReportBadgeAsset(undefined), null);
  assert.equal(resolveMonthlyReportBadgeAsset(null), null);
  assert.equal(resolveMonthlyReportBadgeAsset({ key: "stellar" }), null);
  assert.equal(resolveMonthlyReportBadgeAsset(42), null);
});

test("never silently maps an unknown badge value to Stellar (or any other tier) -- unknown input must stay null, never default to a specific badge", () => {
  const results = ["Stellar", "STELLAR", "course-correction", "oncourse", ""].map((value) =>
    resolveMonthlyReportBadgeAsset(value),
  );
  for (const result of results) {
    assert.equal(result, null);
  }
});

test("does not expose the raw asset map -- only the resolver function is exported, so there is exactly one way to look up a badge asset", () => {
  assert.deepEqual(Object.keys(monthlyReportBadgeAssetModule), ["resolveMonthlyReportBadgeAsset"]);
});

// This is the exact shape captured from a real finalised report_snapshot.badge
// in the database while investigating the "badge is undefined" crash (Postgres
// jsonb round-trips objects faithfully -- the crash was never about this
// shape being malformed; report.badge.key was always the valid string
// "course_correction"). Kept verbatim as a regression fixture.
test("resolves correctly from a realistic full MonthlyReportBadge object as stored in a frozen report_snapshot, not just a bare string", () => {
  const realFrozenBadge = {
    key: "course_correction",
    sufficientEvidence: false,
    academicThresholdPassed: false,
    completionThresholdPassed: false,
    punctualityThresholdPassed: true,
  };
  const asset = resolveMonthlyReportBadgeAsset(realFrozenBadge.key);
  assert.deepEqual(asset, {
    src: "/badges/performance/course-correction.png",
    alt: "Course Correction performance badge",
    label: "Course Correction",
  });
});
