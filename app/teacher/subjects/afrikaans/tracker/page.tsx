import { TeacherSubjectLearningTrackerPage } from "@/components/subjects/TeacherSubjectLearningTrackerPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function AfrikaansLearningTrackerPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <TeacherSubjectLearningTrackerPage subjectKey={subjectKey} />;
}
