export type LearnerSubjectStatus = "pending" | "approved" | "declined";

export function learnerSubjectGrantsAccess(
  status: LearnerSubjectStatus,
  isActive: boolean,
) {
  return status === "approved" && isActive;
}
