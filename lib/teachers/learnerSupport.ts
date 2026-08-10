export type LearnerSupportStatus = "On Track" | "Needs Support" | "At Risk";

export function getLearnerSupportStatus(
  overdueItemCount: number,
): LearnerSupportStatus {
  if (overdueItemCount >= 4) return "At Risk";
  if (overdueItemCount === 3) return "Needs Support";
  return "On Track";
}

