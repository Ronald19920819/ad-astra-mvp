import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePerformancePercentage,
  formatReviewedDate,
  resolveDisplayedTeacherComment,
  resolvePerformanceBadge,
  resolveTeacherAttribution,
} from "./teacherFeedbackPresentation";

test("resolveDisplayedTeacherComment returns a real trimmed comment as-is", () => {
  assert.equal(
    resolveDisplayedTeacherComment("  Great work on this activity!  "),
    "Great work on this activity!",
  );
});

test("resolveDisplayedTeacherComment falls back on null", () => {
  assert.equal(
    resolveDisplayedTeacherComment(null),
    "Your activity has been reviewed. Open your work to see your detailed feedback.",
  );
});

test("resolveDisplayedTeacherComment falls back on an empty string", () => {
  assert.equal(
    resolveDisplayedTeacherComment(""),
    "Your activity has been reviewed. Open your work to see your detailed feedback.",
  );
});

test("resolveDisplayedTeacherComment falls back on a whitespace-only string", () => {
  assert.equal(
    resolveDisplayedTeacherComment("   \n\t  "),
    "Your activity has been reviewed. Open your work to see your detailed feedback.",
  );
});

test("formatReviewedDate renders a day + full month name", () => {
  // 2026-08-29T10:00:00Z is safely 29 August in Africa/Johannesburg (UTC+2).
  assert.equal(formatReviewedDate("2026-08-29T10:00:00.000Z"), "29 August");
});

test("formatReviewedDate handles a different month correctly", () => {
  assert.equal(formatReviewedDate("2026-01-03T10:00:00.000Z"), "3 January");
});

test("calculatePerformancePercentage computes earned over frozen total, never Kingdom's preliminary basis", () => {
  assert.equal(calculatePerformancePercentage(16, 20), 80);
  assert.equal(calculatePerformancePercentage(0, 0), 0);
});

test("resolvePerformanceBadge: exactly 80% selects Stellar (lower boundary inclusive)", () => {
  assert.equal(resolvePerformanceBadge(16, 20).key, "stellar");
});

test("resolvePerformanceBadge: 100% selects Stellar", () => {
  assert.equal(resolvePerformanceBadge(20, 20).key, "stellar");
});

test("resolvePerformanceBadge: just below 80% selects On Course, not Stellar", () => {
  assert.equal(resolvePerformanceBadge(79, 100).key, "on-course");
});

test("resolvePerformanceBadge: exactly 60% selects On Course (lower boundary inclusive)", () => {
  assert.equal(resolvePerformanceBadge(12, 20).key, "on-course");
});

test("resolvePerformanceBadge: just below 60% selects Course Correction", () => {
  assert.equal(resolvePerformanceBadge(59, 100).key, "course-correction");
});

test("resolvePerformanceBadge: 0% selects Course Correction", () => {
  assert.equal(resolvePerformanceBadge(0, 20).key, "course-correction");
});

test("resolvePerformanceBadge returns the correct asset path and non-empty alt text for each tier", () => {
  const stellar = resolvePerformanceBadge(20, 20);
  assert.equal(stellar.imageSrc, "/badges/performance/stellar.png");
  assert.ok(stellar.altText.length > 0);

  const onCourse = resolvePerformanceBadge(14, 20);
  assert.equal(onCourse.imageSrc, "/badges/performance/on-course.png");
  assert.ok(onCourse.altText.length > 0);

  const courseCorrection = resolvePerformanceBadge(5, 20);
  assert.equal(courseCorrection.imageSrc, "/badges/performance/course-correction.png");
  assert.ok(courseCorrection.altText.length > 0);
});

test("resolveTeacherAttribution builds the 'Feedback from Teacher X' label from a real first name", () => {
  assert.equal(resolveTeacherAttribution("Ronald"), "Feedback from Teacher Ronald");
});

test("resolveTeacherAttribution falls back gracefully when no teacher name is available", () => {
  assert.equal(resolveTeacherAttribution(null), "Feedback from your teacher");
  assert.equal(resolveTeacherAttribution("   "), "Feedback from your teacher");
});
