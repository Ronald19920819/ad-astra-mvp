import { TeacherSubjectLearningTrackerPage } from "@/components/subjects/TeacherSubjectLearningTrackerPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function BusinessStudiesLearningTracker({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <TeacherSubjectLearningTrackerPage subjectKey={subjectKey} />;
}
