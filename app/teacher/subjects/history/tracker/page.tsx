import { TeacherSubjectLearningTrackerPage } from "@/components/subjects/TeacherSubjectLearningTrackerPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function HistoryLearningTrackerPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <TeacherSubjectLearningTrackerPage subjectKey={subjectKey} />;
}
