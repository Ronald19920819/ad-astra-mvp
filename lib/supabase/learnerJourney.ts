import "server-only";

import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import {
  calculateOverallSubjectAverage,
  countActiveApprovedSubjects,
  getLearnerAchievement,
  type LearnerJourney,
} from "@/lib/progress/learnerJourney";
import { getSubjectLearnerOverview } from "@/lib/supabase/businessStudiesLearnerOverview";
import { getLearnerWorkOverview } from "@/lib/supabase/learnerWorkReader";

export async function getLearnerJourney(
  profile: AuthenticatedLearnerProfile,
): Promise<LearnerJourney> {
  const subjectOverviews = await Promise.all(
    profile.approvedSubjects.map(async (subject) => ({
      subjectId: subject.id,
      overview: await getSubjectLearnerOverview(profile.userId, subject.id),
    })),
  );
  const subjectMarks = subjectOverviews.map(
    ({ overview }) =>
      ({
      overallMark: overview.progress.overallMark,
      status: "approved",
      isActive: true,
      }) as const,
  );
  const overallSubjectAverage = calculateOverallSubjectAverage(subjectMarks);
  const approvedSubjectIds = new Set(
    profile.approvedSubjects.map((subject) => subject.id),
  );
  const learnerWork = await getLearnerWorkOverview(profile.userId);
  const completedActivities = learnerWork.filter(
    (submission) =>
      approvedSubjectIds.has(submission.subject.id) &&
      submission.status === "returned" &&
      submission.finalMark !== null,
  ).length;

  return {
    overallSubjectAverage,
    currentAchievement: getLearnerAchievement(overallSubjectAverage),
    activeSubjects: countActiveApprovedSubjects(subjectMarks),
    completedActivities,
  };
}
