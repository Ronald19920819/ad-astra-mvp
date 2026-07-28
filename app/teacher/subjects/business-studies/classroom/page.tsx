import { TeacherSubjectClassroomPage } from "@/components/subjects/TeacherSubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function BusinessStudiesTeacherClassroom({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <TeacherSubjectClassroomPage subjectKey={subjectKey} />;
}
