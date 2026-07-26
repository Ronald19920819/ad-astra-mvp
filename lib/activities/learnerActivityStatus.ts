export type LearnerActivitySubmissionStatus =
  | "submitted"
  | "marking_failed"
  | "awaiting_review"
  | "returned";

export type LearnerActivityStatus =
  | LearnerActivitySubmissionStatus
  | "current"
  | "not_submitted";

export type LearnerActivityStatusTone =
  | "submitted"
  | "current"
  | "attention_required";

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dueDateKey(dueDate: string | null) {
  return dueDate?.slice(0, 10) ?? null;
}

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

  const dueKey = dueDateKey(dueDate);
  if (!dueKey) return "current";

  const today = dateKeyInTimeZone(now, timeZone);
  return dueKey < today ? "not_submitted" : "current";
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
    case "not_submitted":
      return "Not Submitted";
  }
}

export function getLearnerActivityStatusTone(
  status: LearnerActivityStatus,
): LearnerActivityStatusTone {
  if (status === "current") return "current";
  if (status === "not_submitted") return "attention_required";
  return "submitted";
}
