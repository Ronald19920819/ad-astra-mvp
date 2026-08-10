export const SUBJECT_TEACHER_FALLBACK = "Teacher";

const GENERIC_LEARNER_HIDDEN_TEACHER_LABELS = new Set([
  "teacher",
  "test teacher",
]);

function normalizeTeacherLabel(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function isHiddenGenericTeacherLabel(name: string) {
  return GENERIC_LEARNER_HIDDEN_TEACHER_LABELS.has(normalizeTeacherLabel(name));
}

function getLearnerFacingTeacherNames(teacherNames?: readonly string[] | null) {
  const resolvedNames = (teacherNames ?? []).filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0,
  );

  if (resolvedNames.length <= 1) {
    return resolvedNames;
  }

  const specificNames = resolvedNames.filter(
    (name) => !isHiddenGenericTeacherLabel(name),
  );

  return specificNames.length > 0 ? specificNames : resolvedNames;
}

function initialsFromDisplayName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "T";

  const firstInitial = parts[0]?.[0]?.toUpperCase() ?? "";
  if (!firstInitial) return "T";

  if (parts.length === 1) {
    return firstInitial;
  }

  const lastInitial = parts[parts.length - 1]?.[0]?.toUpperCase() ?? "";
  return `${firstInitial}${lastInitial}` || "T";
}

export function formatSubjectTeacherLabel(teacherNames?: readonly string[] | null) {
  const learnerFacingNames = getLearnerFacingTeacherNames(teacherNames);

  return learnerFacingNames.length > 0
    ? learnerFacingNames.join(" \u00B7 ")
    : SUBJECT_TEACHER_FALLBACK;
}

export function getSubjectTeacherInitials(teacherNames?: readonly string[] | null) {
  const learnerFacingNames = getLearnerFacingTeacherNames(teacherNames);

  if (learnerFacingNames.length === 0) {
    return "T";
  }

  return initialsFromDisplayName(learnerFacingNames[0]);
}