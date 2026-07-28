import { TeacherSubjectActivitiesPage } from "@/components/subjects/TeacherSubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function EnglishActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectActivitiesPage subjectKey={subjectKey} />;
}
