import { TeacherSubjectClassroomPage } from "@/components/subjects/TeacherSubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function HistoryClassroomPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <TeacherSubjectClassroomPage subjectKey={subjectKey} />;
}
