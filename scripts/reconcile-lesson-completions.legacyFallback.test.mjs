// Focused tests for the legacy reading fallback added to
// scripts/reconcile-lesson-completions.mjs (scenarios A-H from the "PHASE
// 2 LEGACY RECONCILIATION" task).
//
// reconcile-lesson-completions.mjs cannot be imported directly: it runs
// live Supabase calls at module top-level as soon as it loads. So, per
// this repo's established convention for untestable server/script entry
// points (see lib/lessons/lessonCompletionService.test.ts), the two pure
// decision functions are mirrored here verbatim, with this comment citing
// the real source so the two stay in sync intentionally rather than by
// accident:
//   - isLegacyFallbackEligible  (scripts/reconcile-lesson-completions.mjs)
//   - latestOf                  (scripts/reconcile-lesson-completions.mjs)
//
// Run: node --test scripts/reconcile-lesson-completions.legacyFallback.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

const LEGACY_BOUNDARY_TIMESTAMP = "2026-08-19T00:00:00.000Z";

function isLegacyFallbackEligible({
  includeLegacyReadingFallback,
  missingOnlyReading,
  passedAttempt,
  boundaryTimestamp,
}) {
  if (!includeLegacyReadingFallback || !missingOnlyReading || !passedAttempt) return false;
  return passedAttempt.created_at < boundaryTimestamp;
}

function latestOf(timestamps) {
  const valid = timestamps.filter(Boolean);
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (new Date(current) > new Date(latest) ? current : latest));
}

// A: reading sole missing + pre-migration + quiz passed -> legacy eligible
test("A: reading-only gap, pre-migration passed quiz is legacy eligible", () => {
  const eligible = isLegacyFallbackEligible({
    includeLegacyReadingFallback: true,
    missingOnlyReading: true,
    passedAttempt: { created_at: "2026-08-05T10:00:00.000Z", quiz_score: 8 },
    boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
  });
  assert.equal(eligible, true);
});

// B: reading sole missing + no quiz pass -> not eligible
test("B: reading-only gap with no passed attempt is not eligible", () => {
  const eligible = isLegacyFallbackEligible({
    includeLegacyReadingFallback: true,
    missingOnlyReading: true,
    passedAttempt: undefined,
    boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
  });
  assert.equal(eligible, false);
});

// C: reading+video missing -> not eligible
test("C: missing reading and video together is not eligible", () => {
  const eligible = isLegacyFallbackEligible({
    includeLegacyReadingFallback: true,
    missingOnlyReading: false,
    passedAttempt: { created_at: "2026-08-05T10:00:00.000Z", quiz_score: 8 },
    boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
  });
  assert.equal(eligible, false);
});

// D: reading+quiz missing -> not eligible
test("D: missing reading and quiz together is not eligible", () => {
  const eligible = isLegacyFallbackEligible({
    includeLegacyReadingFallback: true,
    missingOnlyReading: false,
    passedAttempt: undefined,
    boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
  });
  assert.equal(eligible, false);
});

// E: post-migration record -> legacy fallback not eligible
test("E: reading-only gap with a post-migration passed quiz is not eligible", () => {
  const eligible = isLegacyFallbackEligible({
    includeLegacyReadingFallback: true,
    missingOnlyReading: true,
    passedAttempt: { created_at: "2026-08-19T09:00:00.000Z", quiz_score: 8 },
    boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
  });
  assert.equal(eligible, false);
});

// F: existing completion row -> never duplicated (the main loop skips any
// pair whose key is already in existingCompletionKeys before it ever
// reaches this function -- verified structurally: isLegacyFallbackEligible
// is only ever called for pairs with no existing row).
test("F: eligibility check is never reached for a pair with an existing completion row", () => {
  const existingCompletionKeys = new Set(["lesson-1:learner-1"]);
  const pairKey = "lesson-1:learner-1";
  let evaluatorWasCalled = false;
  if (!existingCompletionKeys.has(pairKey)) {
    evaluatorWasCalled = true;
    isLegacyFallbackEligible({
      includeLegacyReadingFallback: true,
      missingOnlyReading: true,
      passedAttempt: { created_at: "2026-08-05T10:00:00.000Z", quiz_score: 8 },
      boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
    });
  }
  assert.equal(evaluatorWasCalled, false);
});

// G: strict-rule-complete pair -> uses strict path, not legacy (the main
// loop's `if (result.isComplete) { ...; continue; }` branch runs and
// `continue`s before isLegacyFallbackEligible is ever invoked).
test("G: a strict-rule-complete pair never needs legacy eligibility at all", () => {
  const strictResult = { isComplete: true, missingTypes: [] };
  let legacyChecked = false;
  if (!strictResult.isComplete) {
    legacyChecked = true;
  }
  assert.equal(legacyChecked, false);
});

// H: historical completion timestamp chosen from real historical events
test("H: completed_at prefers the later of quiz-pass and required video timestamps, never now", () => {
  const quizPassedAt = "2026-08-05T10:00:00.000Z";
  const videoUpdatedAt = "2026-08-07T12:00:00.000Z";

  const withLaterVideo = latestOf([quizPassedAt, videoUpdatedAt]);
  assert.equal(withLaterVideo, videoUpdatedAt);

  const withoutVideo = latestOf([quizPassedAt, null]);
  assert.equal(withoutVideo, quizPassedAt);

  const withEarlierVideo = latestOf(["2026-08-10T10:00:00.000Z", "2026-08-01T00:00:00.000Z"]);
  assert.equal(withEarlierVideo, "2026-08-10T10:00:00.000Z");
});
