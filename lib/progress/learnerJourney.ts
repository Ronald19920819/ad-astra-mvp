export type SubjectMarkForJourney = {
  overallMark: number | null;
  status: "pending" | "approved" | "declined";
  isActive: boolean;
};

export type LearnerAchievement =
  | "Launchpad Learner"
  | "Orbit Builder"
  | "Stellar Achiever"
  | "Mission Not Started";

export type LearnerJourney = {
  overallSubjectAverage: number | null;
  currentAchievement: LearnerAchievement;
  activeSubjects: number;
  completedActivities: number;
};

export function calculateOverallSubjectAverage(
  subjectMarks: SubjectMarkForJourney[],
) {
  const validMarks = subjectMarks
    .filter(
      (subject) =>
        subject.status === "approved" &&
        subject.isActive &&
        subject.overallMark !== null &&
        Number.isFinite(subject.overallMark),
    )
    .map((subject) => subject.overallMark as number);

  if (validMarks.length === 0) return null;
  return validMarks.reduce((total, mark) => total + mark, 0) / validMarks.length;
}

export function countActiveApprovedSubjects(
  subjects: Pick<SubjectMarkForJourney, "status" | "isActive">[],
) {
  return subjects.filter(
    (subject) => subject.status === "approved" && subject.isActive,
  ).length;
}

export function getLearnerAchievement(
  overallSubjectAverage: number | null,
): LearnerAchievement {
  if (overallSubjectAverage === null) return "Mission Not Started";
  if (overallSubjectAverage < 50) return "Launchpad Learner";
  if (overallSubjectAverage < 75) return "Orbit Builder";
  return "Stellar Achiever";
}
