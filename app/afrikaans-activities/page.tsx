import { SubjectActivitiesPage } from "@/components/subjects/SubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansActivities({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <SubjectActivitiesPage subjectKey={subjectKey} />;
}
