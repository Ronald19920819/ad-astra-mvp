import { TeacherSubjectActivitiesPage } from "@/components/subjects/TeacherSubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <TeacherSubjectActivitiesPage subjectKey={subjectKey} />;
}
