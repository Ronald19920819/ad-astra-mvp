import assert from "node:assert/strict";
import test from "node:test";
import { calculateTeacherReviewScore } from "./teacherReviewScoring";

test("calculateTeacherReviewScore sums marks and percentage", () => {
  const result = calculateTeacherReviewScore([
    { maximumMarks: 4, teacherMark: 3 },
    { maximumMarks: 6, teacherMark: 5 },
  ]);

  assert.deepEqual(result, {
    earnedMarks: 8,
    maximumMarks: 10,
    percentage: 80,
  });
});

test("calculateTeacherReviewScore rejects marks above the maximum", () => {
  assert.throws(
    () =>
      calculateTeacherReviewScore([{ maximumMarks: 4, teacherMark: 5 }]),
    /outside the allowed range/i,
  );
});

test("calculateTeacherReviewScore rejects negative marks", () => {
  assert.throws(
    () =>
      calculateTeacherReviewScore([{ maximumMarks: 4, teacherMark: -1 }]),
    /outside the allowed range/i,
  );
});