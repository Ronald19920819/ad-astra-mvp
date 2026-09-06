import assert from "node:assert/strict";
import test from "node:test";

import { calculateMonthlyReportBadge } from "./monthlyReportBadge";

// AD ASTRA MONTHLY REPORT -- BADGE & KINGDOM COMMENTARY RECALIBRATION:
// punctuality is no longer a badge eligibility gate. Academic Performance
// and Completion decide the badge; punctualityThresholdPassed is still
// computed and returned, but purely informationally.

test("A -- Stellar despite lateness: 84.7% academic + 100% completion + >=4 returned activities + POOR punctuality -> Stellar", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 84.7,
    combinedCompletionRate: 1,
    combinedPunctualityRate: 0.2, // substantial late work
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "stellar");
  assert.equal(badge.academicThresholdPassed, true);
  assert.equal(badge.completionThresholdPassed, true);
  // Reported informationally, but never consulted for `key` above.
  assert.equal(badge.punctualityThresholdPassed, false);
});

test("B -- Course Correction for missing work: 3.9% academic, low completion, 1 returned activity -> Course Correction (already justified by academic result, completion, and insufficient evidence -- no additional punctuality penalty needed)", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 3.9,
    combinedCompletionRate: 0.15,
    combinedPunctualityRate: null,
    sufficientEvidence: false, // returnedActivityCount (1) < 4
  });
  assert.equal(badge.key, "course_correction");
  assert.equal(badge.academicThresholdPassed, false);
  assert.equal(badge.completionThresholdPassed, false);
});

test("C -- On Course: academic between 60-79.99%, completion >=60%, >=4 returned activities -> On Course", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 70,
    combinedCompletionRate: 0.75,
    combinedPunctualityRate: 0.4, // punctuality irrelevant to the gate
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "on_course");
});

test("D -- high marks but low completion must NOT receive Stellar", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 92,
    combinedCompletionRate: 0.3,
    combinedPunctualityRate: 1, // even perfect punctuality cannot substitute for completion
    sufficientEvidence: true,
  });
  assert.notEqual(badge.key, "stellar");
  assert.equal(badge.key, "course_correction");
  assert.equal(badge.completionThresholdPassed, false);
});

test("E -- insufficient evidence (excellent academic percentage, fewer than 4 returned activities) must NOT receive Stellar or On Course", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 95,
    combinedCompletionRate: 1,
    combinedPunctualityRate: 1,
    sufficientEvidence: false,
  });
  assert.equal(badge.key, "course_correction");
  assert.notEqual(badge.key, "stellar");
  assert.notEqual(badge.key, "on_course");
});

test("exactly at the Stellar boundary (80% academic / 80% completion) qualifies for Stellar (thresholds inclusive), regardless of punctuality", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 80,
    combinedCompletionRate: 0.8,
    combinedPunctualityRate: 0,
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "stellar");
});

test("just below the Stellar academic boundary falls back to On Course when the On Course bar is still met", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 79.9,
    combinedCompletionRate: 0.9,
    combinedPunctualityRate: 0.9,
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "on_course");
});

test("below every On Course gate => Course Correction; punctualityThresholdPassed is still reported informationally", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 40,
    combinedCompletionRate: 0.3,
    combinedPunctualityRate: 0.2,
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "course_correction");
  assert.equal(badge.academicThresholdPassed, false);
  assert.equal(badge.completionThresholdPassed, false);
  assert.equal(badge.punctualityThresholdPassed, false);
});

test("null rates (nothing selected in that dimension) never qualify for Stellar or On Course", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: null,
    combinedCompletionRate: null,
    combinedPunctualityRate: null,
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "course_correction");
});

test("a learner cannot earn Stellar by ignoring lessons but submitting every activity -- combined completion (which blends both dimensions) fails the bar, and punctuality cannot rescue it", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 95,
    combinedCompletionRate: 0.5, // 0% lesson completion + 100% activity submission, averaged
    combinedPunctualityRate: 1,
    sufficientEvidence: true,
  });
  assert.equal(badge.key, "course_correction");
  assert.equal(badge.completionThresholdPassed, false);
});

test("exactly 4 marked activities (the locked minimum) counts as sufficient evidence for a positive badge", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 85,
    combinedCompletionRate: 0.9,
    combinedPunctualityRate: 0.9,
    sufficientEvidence: true, // caller already resolved returnedActivityCount(4) < 4 === false
  });
  assert.equal(badge.key, "stellar");
});

test("no fourth 'insufficient evidence' badge state exists -- the key is always one of the three established badges", () => {
  const badge = calculateMonthlyReportBadge({
    academicPercentage: 95,
    combinedCompletionRate: 1,
    combinedPunctualityRate: 1,
    sufficientEvidence: false,
  });
  assert.ok(["stellar", "on_course", "course_correction"].includes(badge.key));
});
