import { isDateOverdue } from "@/lib/dates/deadlineStatus";

export type LearnerActivitySubmissionStatus =
  | "submitted"
  | "marking_failed"
  | "awaiting_review"
  | "returned";

export type LearnerActivityStatus =
  | LearnerActivitySubmissionStatus
  | "current"
  | "incomplete"
  | "not_submitted";

export type LearnerActivityStatusTone =
  | "submitted"
  | "current"
  | "attention_required";

export function isLearnerActivitySubmittedStatus(
  status: LearnerActivityStatus,
): status is LearnerActivitySubmissionStatus {
  return (
    status === "submitted" ||
    status === "marking_failed" ||
    status === "awaiting_review" ||
    status === "returned"
  );
}

export function getLearnerActivityStatus({
  submissionStatus,
  dueDate,
  now = new Date(),
  timeZone = "Africa/Johannesburg",
}: {
  submissionStatus: LearnerActivitySubmissionStatus | null;
  dueDate: string | null;
  now?: Date;
  timeZone?: string;
}): LearnerActivityStatus {
  if (submissionStatus) return submissionStatus;
  return isDateOverdue(dueDate, now, timeZone) ? "not_submitted" : "current";
}

export function getLearnerIncompleteActivityStatus({
  submissionStatus,
  dueDate,
  isCurrent,
  now = new Date(),
  timeZone = "Africa/Johannesburg",
}: {
  submissionStatus: LearnerActivitySubmissionStatus | null;
  dueDate: string | null;
  isCurrent: boolean;
  now?: Date;
  timeZone?: string;
}): LearnerActivityStatus {
  if (submissionStatus) return submissionStatus;
  if (isDateOverdue(dueDate, now, timeZone)) return "not_submitted";
  return isCurrent ? "current" : "incomplete";
}

export function getLearnerActivityStatusLabel(
  status: LearnerActivityStatus,
) {
  switch (status) {
    case "submitted":
    case "marking_failed":
      return "Submitted";
    case "awaiting_review":
      return "Awaiting Review";
    case "returned":
      return "Returned";
    case "current":
      return "Current";
    case "incomplete":
      return "Incomplete";
    case "not_submitted":
      return "Not Submitted";
  }
}

export function getLearnerActivityStatusTone(
  status: LearnerActivityStatus,
): LearnerActivityStatusTone {
  if (status === "current" || status === "incomplete") return "current";
  if (status === "not_submitted") return "attention_required";
  return "submitted";
}

