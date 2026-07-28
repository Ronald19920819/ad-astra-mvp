import { TeacherSubjectOverviewPage } from "@/components/subjects/TeacherSubjectOverviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function TeacherEnglishPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectOverviewPage subjectKey={subjectKey} />;
}
