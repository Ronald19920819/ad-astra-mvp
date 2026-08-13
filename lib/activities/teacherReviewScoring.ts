export type TeacherReviewScoreEntry = {
  maximumMarks: number;
  teacherMark: number;
};

export type TeacherReviewScoreSummary = {
  earnedMarks: number;
  maximumMarks: number;
  percentage: number;
};

export function calculateTeacherReviewScore(
  entries: TeacherReviewScoreEntry[],
): TeacherReviewScoreSummary {
  let earnedMarks = 0;
  let maximumMarks = 0;

  for (const entry of entries) {
    if (
      !Number.isInteger(entry.maximumMarks) ||
      entry.maximumMarks < 0 ||
      !Number.isInteger(entry.teacherMark) ||
      entry.teacherMark < 0 ||
      entry.teacherMark > entry.maximumMarks
    ) {
      throw new RangeError("A teacher mark is outside the allowed range.");
    }

    earnedMarks += entry.teacherMark;
    maximumMarks += entry.maximumMarks;
  }

  return {
    earnedMarks,
    maximumMarks,
    percentage:
      maximumMarks > 0 ? Number(((earnedMarks / maximumMarks) * 100).toFixed(2)) : 0,
  };
}