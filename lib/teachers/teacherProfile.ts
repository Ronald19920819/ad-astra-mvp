export type TeacherProfileSubject = {
  id: string;
  name: string;
  slug: string;
};

export type AuthenticatedTeacherProfile = {
  userId: string;
  profileId: string;
  teacherProfileId: string;
  firstName: string;
  surname: string;
  displayName: string;
  email: string | null;
  school: string | null;
  profileImageUrl: string | null;
  role: "teacher";
  isAdministrator: boolean;
  accountStatus: string;
  facultyName: string | null;
  assignedSubjects: TeacherProfileSubject[];
};

export type TeacherTeachingOverview = {
  subjectsTaught: number;
  activeLearners: number;
  publishedLessons: number;
  publishedActivities: number;
  submissionsAwaitingReview: number;
};

export type TeacherProfileDashboard = {
  profile: AuthenticatedTeacherProfile;
  teachingOverview: TeacherTeachingOverview;
};

export function countDistinctActiveLearners(
  learnerProfileIds: Iterable<string>,
) {
  return new Set(learnerProfileIds).size;
}
