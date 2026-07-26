export type AuthenticatedLearnerProfile = {
  userId: string;
  profileId: string;
  learnerProfileId: string;
  firstName: string;
  surname: string;
  fullName: string;
  displayName: string;
  initials: string;
  email: string | null;
  school: string | null;
  gradeStage: string | null;
  gradeOrStage: string | null;
  profileImageUrl: string | null;
  role: "learner";
  accountStatus: string;
  enrolledSubjectCount: number;
  approvedSubjects: LearnerProfileSubject[];
  pendingSubjects: LearnerProfileSubject[];
  pendingSubjectRequests: LearnerProfileSubject[];
  declinedSubjects: LearnerProfileSubject[];
  declinedSubjectRequests: LearnerProfileSubject[];
};

export type LearnerProfileSubject = {
  id: string;
  name: string;
  slug: string;
};

export function splitLearnerDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    surname: parts.slice(1).join(" "),
  };
}

export function getLearnerInitials(
  profile: Pick<
    AuthenticatedLearnerProfile,
    "firstName" | "surname" | "displayName"
  > | null,
) {
  return getProfileInitials(profile, "L");
}
import { getProfileInitials } from "../profiles/profileIdentity";
