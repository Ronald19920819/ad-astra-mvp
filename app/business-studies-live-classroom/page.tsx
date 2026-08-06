import { SubjectLiveClassroomPage } from "@/components/subjects/SubjectLiveClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function BusinessStudiesLiveClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <SubjectLiveClassroomPage subjectKey={subjectKey} />;
}
