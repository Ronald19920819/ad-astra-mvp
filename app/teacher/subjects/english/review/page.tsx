import { TeacherSubjectActivityReviewPage } from "@/components/subjects/TeacherSubjectActivityReviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function EnglishActivityReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return <TeacherSubjectActivityReviewPage subjectKey={subjectKey} />;
}
