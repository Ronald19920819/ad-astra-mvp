import { SubjectClassroomPage } from "@/components/subjects/SubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function BusinessStudiesClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <SubjectClassroomPage subjectKey={subjectKey} />;
}
