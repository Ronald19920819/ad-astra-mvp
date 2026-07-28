import { TeacherSubjectActivitiesPage } from "@/components/subjects/TeacherSubjectActivitiesPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function BusinessStudiesTeacherActivities({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <TeacherSubjectActivitiesPage subjectKey={subjectKey} />;
}
