import { TeacherSubjectLiveClassroomPage } from "@/components/subjects/TeacherSubjectLiveClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function BusinessStudiesTeacherLiveClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <TeacherSubjectLiveClassroomPage subjectKey={subjectKey} />;
}
