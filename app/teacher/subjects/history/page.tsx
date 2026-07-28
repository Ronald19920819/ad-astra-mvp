import { TeacherSubjectOverviewPage } from "@/components/subjects/TeacherSubjectOverviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function TeacherHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <TeacherSubjectOverviewPage subjectKey={subjectKey} />;
}
