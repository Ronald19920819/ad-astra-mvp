export type SubjectNextAction =
  | "Lesson & Activity"
  | "Lesson"
  | "Activity"
  | "None";

export function getSubjectNextAction({
  hasIncompleteLesson,
  hasIncompleteActivity,
}: {
  hasIncompleteLesson: boolean;
  hasIncompleteActivity: boolean;
}): SubjectNextAction {
  if (hasIncompleteLesson && hasIncompleteActivity) {
    return "Lesson & Activity";
  }
  if (hasIncompleteLesson) return "Lesson";
  if (hasIncompleteActivity) return "Activity";
  return "None";
}

export function getSubjectCardStatus(nextAction: SubjectNextAction) {
  return nextAction === "None" ? "Up to Date" : "Attention Required";
}
