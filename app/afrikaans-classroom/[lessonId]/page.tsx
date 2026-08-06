import { SubjectLessonRoutePage } from "@/components/subjects/SubjectLessonRoutePage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <SubjectLessonRoutePage lessonId={lessonId} subjectKey={subjectKey} />;
}
