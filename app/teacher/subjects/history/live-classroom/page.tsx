import { TeacherSubjectLiveClassroomPage } from "@/components/subjects/TeacherSubjectLiveClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function HistoryTeacherLiveClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <TeacherSubjectLiveClassroomPage subjectKey={subjectKey} />;
}
