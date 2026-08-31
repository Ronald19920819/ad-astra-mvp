// Pure, DOM-free presentation helpers for the learner Home page's Teacher
// Feedback card (components/home/TeacherFeedbackCard.tsx). Kept separate
// so the fallback/formatting DECISIONS are directly testable without
// rendering a "use client" component.

const MISSING_COMMENT_FALLBACK =
  "Your activity has been reviewed. Open your work to see your detailed feedback.";

// A returned submission could theoretically have a null/empty
// teacher_comment (AD ASTRA FEEDBACK-RETURN STAGE 1 section 9) -- this
// must never crash or hide the review, only fall back to a restrained
// message. The "View My Reviewed Work" button always still works
// regardless of which text is shown here.
export function resolveDisplayedTeacherComment(teacherComment: string | null): string {
  const trimmed = teacherComment?.trim();
  return trimmed ? trimmed : MISSING_COMMENT_FALLBACK;
}

// "29 August" -- day + full month name, deliberately shorter than the
// app's usual dateStyle:"medium" (which includes the year) since this is
// a compact dashboard card, not a full record. Matches this stage's own
// conceptual example ("Reviewed 29 August").
export function formatReviewedDate(reviewedAtIso: string): string {
  return new Date(reviewedAtIso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Johannesburg",
  });
}

export type PerformanceBadgeKey = "stellar" | "on-course" | "course-correction";

export type PerformanceBadge = {
  key: PerformanceBadgeKey;
  imageSrc: string;
  altText: string;
};

// The three permanent badge assets in public/badges/performance/ -- these
// are the ONLY visual representation of performance on this card; the
// underlying percentage and raw mark are deliberately never rendered
// (AD ASTRA PERSONALISED FEEDBACK CARD section 2).
const PERFORMANCE_BADGES: Record<PerformanceBadgeKey, PerformanceBadge> = {
  stellar: {
    key: "stellar",
    imageSrc: "/badges/performance/stellar.png",
    altText: "Stellar performance badge",
  },
  "on-course": {
    key: "on-course",
    imageSrc: "/badges/performance/on-course.png",
    altText: "On Course performance badge",
  },
  "course-correction": {
    key: "course-correction",
    imageSrc: "/badges/performance/course-correction.png",
    altText: "Course Correction performance badge",
  },
};

// Mirrors the authoritative percentage basis already used to validate a
// teacher's final mark (see calculateTeacherReviewScore in
// lib/activities/teacherReviewScoring.ts): earned marks over the frozen
// total-marks basis for the submission, never Kingdom's preliminary mark.
export function calculatePerformancePercentage(
  finalMark: number,
  totalMarks: number,
): number {
  if (totalMarks <= 0) return 0;
  return (finalMark / totalMarks) * 100;
}

// 80-100% -> Stellar, 60-79% -> On Course, below 60% -> Course Correction.
export function resolvePerformanceBadge(
  finalMark: number,
  totalMarks: number,
): PerformanceBadge {
  const percentage = calculatePerformancePercentage(finalMark, totalMarks);
  if (percentage >= 80) return PERFORMANCE_BADGES.stellar;
  if (percentage >= 60) return PERFORMANCE_BADGES["on-course"];
  return PERFORMANCE_BADGES["course-correction"];
}

// "Feedback from Teacher Ronald" -- the attribution changes with whichever
// review is currently displayed, so this stays a pure function of the
// active item's resolved teacher first name rather than being baked into
// the reader.
export function resolveTeacherAttribution(teacherFirstName: string | null): string {
  const trimmed = teacherFirstName?.trim();
  return trimmed ? `Feedback from Teacher ${trimmed}` : "Feedback from your teacher";
}
