import { SubjectClassroomPage } from "@/components/subjects/SubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function HistoryClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <SubjectClassroomPage subjectKey={subjectKey} />;
}
