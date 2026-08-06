import { SubjectActivitiesPage } from "@/components/subjects/SubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function BusinessStudiesActivities({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <SubjectActivitiesPage subjectKey={subjectKey} />;
}
