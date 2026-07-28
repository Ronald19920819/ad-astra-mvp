import { SubjectActivityPage } from "@/components/subjects/SubjectActivityPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <SubjectActivityPage subjectKey={subjectKey} />;
}
