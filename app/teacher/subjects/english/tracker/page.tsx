import { TeacherSubjectLearningTrackerPage } from "@/components/subjects/TeacherSubjectLearningTrackerPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function EnglishLearningTrackerPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectLearningTrackerPage subjectKey={subjectKey} />;
}
