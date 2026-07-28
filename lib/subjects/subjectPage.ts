import {
  type SubjectFamilyKey,
  type SubjectKey,
  getCanonicalSubjectConfiguration,
  getSubjectConfigurationByDatabaseId,
} from "@/lib/subjects/subjectConfig";

function firstSearchParamValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveSubjectKeyFromSearchParams(
  familyKey: SubjectFamilyKey,
  searchParams?: { subject?: string | string[] },
): SubjectKey {
  const selectedSubjectId = firstSearchParamValue(searchParams?.subject);
  if (selectedSubjectId) {
    const subject = getSubjectConfigurationByDatabaseId(selectedSubjectId);
    if (subject && subject.familyKey === familyKey) {
      return subject.key;
    }
  }

  return getCanonicalSubjectConfiguration(familyKey).key;
}
