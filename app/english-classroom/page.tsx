import { SubjectClassroomPage } from "@/components/subjects/SubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function EnglishClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <SubjectClassroomPage subjectKey={subjectKey} />;
}
