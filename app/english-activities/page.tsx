import { SubjectActivitiesPage } from "@/components/subjects/SubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function EnglishActivities({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <SubjectActivitiesPage subjectKey={subjectKey} />;
}
