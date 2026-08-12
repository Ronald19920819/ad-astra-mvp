import { TeacherSubjectLearnerProfilePage } from "@/components/subjects/TeacherSubjectLearnerProfilePage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function AfrikaansLearnerProfileRoute({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return (
    <TeacherSubjectLearnerProfilePage
      params={params}
      subjectKey={subjectKey}
    />
  );
}
