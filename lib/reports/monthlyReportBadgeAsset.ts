import type { MonthlyReportBadgeKey } from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
//
// The ONE canonical mapping from a badge key to its display asset. Both
// the teacher-facing preview (MonthlyReportGenerator.tsx) and the public,
// unauthenticated report view (PublicMonthlyReportView.tsx) must resolve
// a badge through resolveMonthlyReportBadgeAsset below -- never a
// separate, ad hoc lookup -- so the two surfaces can never silently
// disagree about what a given key means, and the mapping is defined
// exactly once.
//
// This lives in its own plain module (no "use client", no next/image, no
// next/font) specifically so it can be imported safely from anywhere --
// a Server Component, a Client Component, or a plain node:test run --
// without depending on which side of a client/server boundary the caller
// happens to be on.
export type MonthlyReportBadgeAsset = {
  src: string;
  alt: string;
  label: string;
};

const BADGE_ASSET_BY_KEY: Record<MonthlyReportBadgeKey, MonthlyReportBadgeAsset> = {
  stellar: {
    src: "/badges/performance/stellar.png",
    alt: "Stellar performance badge",
    label: "Stellar",
  },
  on_course: {
    src: "/badges/performance/on-course.png",
    alt: "On Course performance badge",
    label: "On Course",
  },
  course_correction: {
    src: "/badges/performance/course-correction.png",
    alt: "Course Correction performance badge",
    label: "Course Correction",
  },
};

// Accepts `unknown` rather than MonthlyReportBadgeKey deliberately: a
// FINALISED report's report_snapshot is a frozen historical jsonb blob
// that may have been written by an older, since-changed version of the
// Monthly Report engine, so its badge.key can never be trusted to still
// match the current MonthlyReportBadgeKey union at compile time. Returns
// null (never throws, never guesses/defaults to a specific tier) for any
// value that isn't one of the three currently-known keys -- callers must
// render an explicit, neutral fallback for null rather than assuming a
// badge asset always exists.
export function resolveMonthlyReportBadgeAsset(key: unknown): MonthlyReportBadgeAsset | null {
  if (typeof key === "string" && Object.prototype.hasOwnProperty.call(BADGE_ASSET_BY_KEY, key)) {
    return BADGE_ASSET_BY_KEY[key as MonthlyReportBadgeKey];
  }
  return null;
}
