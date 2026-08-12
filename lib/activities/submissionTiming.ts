export type SubmissionTimingStatus =
  | "due_date_not_set"
  | "on_time"
  | "late";

export type SubmissionTiming = {
  status: SubmissionTimingStatus;
  label: string;
  className: string;
};

export function getSubmissionDateKey(submittedAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(submittedAt));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function getSubmissionTiming(
  submittedAt: string,
  dueDate: string | null,
): SubmissionTiming {
  if (!dueDate) {
    return {
      status: "due_date_not_set",
      label: "Due date not set",
      className: "bg-slate-100 text-slate-600",
    };
  }

  return getSubmissionDateKey(submittedAt) > dueDate
    ? {
        status: "late",
        label: "Late",
        className: "bg-red-100 text-red-700",
      }
    : {
        status: "on_time",
        label: "On time",
        className: "bg-green-100 text-green-700",
      };
}
