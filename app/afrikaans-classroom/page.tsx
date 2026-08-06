import { SubjectClassroomPage } from "@/components/subjects/SubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <SubjectClassroomPage subjectKey={subjectKey} />;
}
