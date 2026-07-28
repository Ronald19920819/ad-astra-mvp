import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function EnglishSubmissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "english",
    await searchParams,
  );

  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey={subjectKey}
    />
  );
}
