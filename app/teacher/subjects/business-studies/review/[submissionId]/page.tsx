import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export const dynamic = "force-dynamic";

export default async function BusinessStudiesSubmissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "business-studies",
    await searchParams,
  );

  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey={subjectKey}
    />
  );
}
