import { TeacherSubjectActivityReviewPage } from "@/components/subjects/TeacherSubjectActivityReviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function BusinessStudiesTeacherReview({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return <TeacherSubjectActivityReviewPage subjectKey={subjectKey} />;
}
