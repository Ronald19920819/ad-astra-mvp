import { SubjectLiveClassroomPage } from "@/components/subjects/SubjectLiveClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function EnglishLiveClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <SubjectLiveClassroomPage subjectKey={subjectKey} />;
}
