export type LearnerApprovalRequest = {
  id: string;
  learnerName: string;
  learnerEmail: string | null;
  school: string | null;
  gradeOrStage: string | null;
  subjectId: string;
  subjectName: string;
  requestedAt: string;
  status: "pending";
};

export function canTeacherReviewSubject(
  assignedSubjectIds: Iterable<string>,
  requestedSubjectId: string,
) {
  return new Set(assignedSubjectIds).has(requestedSubjectId);
}

export function approvalTransition(action: "approve" | "decline") {
  return action === "approve"
    ? { status: "approved" as const, is_active: true }
    : { status: "declined" as const, is_active: false };
}

export function canReviewLearnerRequest(input: {
  authenticatedRole: "learner" | "teacher" | null;
  teacherIsActive: boolean;
  assignedSubjectIds: Iterable<string>;
  requestedSubjectId: string;
}) {
  return (
    input.authenticatedRole === "teacher" &&
    input.teacherIsActive &&
    canTeacherReviewSubject(
      input.assignedSubjectIds,
      input.requestedSubjectId,
    )
  );
}
