import { TeacherSubjectClassroomPage } from "@/components/subjects/TeacherSubjectClassroomPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function EnglishClassroomPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectClassroomPage subjectKey={subjectKey} />;
}
