import assert from "node:assert/strict";
import test from "node:test";

import { calculateDueActivityAcademicAverage } from "./dueActivityAcademicAverage";
import type { DueActivityAcademicItem } from "./dueActivityAcademicAverage";

function returned(percentage: number): DueActivityAcademicItem {
  return { hasAuthoritativeMark: true, percentage, submissionStatus: "returned", isOverdue: false };
}
function overdueMissing(): DueActivityAcademicItem {
  return { hasAuthoritativeMark: false, percentage: null, submissionStatus: "not_submitted", isOverdue: true };
}
function notYetDue(): DueActivityAcademicItem {
  return { hasAuthoritativeMark: false, percentage: null, submissionStatus: "not_submitted", isOverdue: false };
}
function awaitingReview(): DueActivityAcademicItem {
  return { hasAuthoritativeMark: false, percentage: null, submissionStatus: "awaiting_review", isOverdue: false };
}
function submittedNotYetMarked(): DueActivityAcademicItem {
  return { hasAuthoritativeMark: false, percentage: null, submissionStatus: "submitted", isOverdue: false };
}

test("10 due activities, one returned at 38%, nine missing -> 3.8%", () => {
  const items = [returned(38), ...Array.from({ length: 9 }, overdueMissing)];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.effectiveActivityCount, 10);
  assert.equal(result.returnedActivityCount, 1);
  assert.equal(result.overdueMissingActivityCount, 9);
  assert.ok(Math.abs(result.average! - 3.8) < 1e-9);
});

test("two returned (80%, 70%) equally weighted regardless of raw marks, plus three missing -> 30%", () => {
  const items = [returned(80), returned(70), overdueMissing(), overdueMissing(), overdueMissing()];
  const result = calculateDueActivityAcademicAverage(items);
  // (80 + 70 + 0 + 0 + 0) / 5 = 30
  assert.equal(result.average, 30);
});

test("8 returned averaging 80%, 1 awaiting review, 1 overdue missing -> effective denominator is 9, not 10", () => {
  const items = [...Array.from({ length: 8 }, () => returned(80)), awaitingReview(), overdueMissing()];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.effectiveActivityCount, 9);
  assert.equal(result.returnedActivityCount, 8);
  assert.equal(result.overdueMissingActivityCount, 1);
  assert.equal(result.awaitingReviewActivityCount, 1);
  // (8 * 80 + 0) / 9
  assert.ok(Math.abs(result.average! - (640 / 9)) < 1e-9);
});

test("a genuinely not-yet-due, unsubmitted activity never reduces the academic average -- fully excluded", () => {
  const items = [returned(90), notYetDue()];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.effectiveActivityCount, 1);
  assert.equal(result.notYetDueActivityCount, 1);
  assert.equal(result.average, 90);
});

test("any submitted-but-not-yet-returned status (submitted, marking_failed, awaiting_review) is excluded, never treated as a zero", () => {
  const items = [returned(50), submittedNotYetMarked(), awaitingReview()];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.effectiveActivityCount, 1);
  assert.equal(result.awaitingReviewActivityCount, 2);
  assert.equal(result.average, 50);
});

test("zero effective activities produces a null average, never 0% or NaN%", () => {
  const items = [notYetDue(), awaitingReview()];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.effectiveActivityCount, 0);
  assert.equal(result.average, null);
});

test("an empty activity list produces a null average with all counts at zero", () => {
  const result = calculateDueActivityAcademicAverage([]);
  assert.deepEqual(result, {
    average: null,
    effectiveActivityCount: 0,
    returnedActivityCount: 0,
    overdueMissingActivityCount: 0,
    awaitingReviewActivityCount: 0,
    notYetDueActivityCount: 0,
  });
});

test("equal weighting is truly independent of raw marks -- a 100-mark activity and a 1-mark activity count identically", () => {
  // The function never receives raw marks at all, only pre-resolved
  // percentages, so this is a structural guarantee: both items below
  // contribute one equal slot each regardless of the (unrepresented) mark
  // totals that produced their percentages.
  const items = [returned(100), returned(0)];
  const result = calculateDueActivityAcademicAverage(items);
  assert.equal(result.average, 50);
});
