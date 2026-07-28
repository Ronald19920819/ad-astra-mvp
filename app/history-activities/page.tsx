import { SubjectActivities } from "@/components/subjects/SubjectActivities";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function HistoryActivities({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <SubjectActivities subjectKey={subjectKey} />;
}
