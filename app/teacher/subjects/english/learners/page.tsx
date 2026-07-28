import { TeacherSubjectLearnersPage } from "@/components/subjects/TeacherSubjectLearnersPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function EnglishLearnersPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectLearnersPage subjectKey={subjectKey} />;
}
