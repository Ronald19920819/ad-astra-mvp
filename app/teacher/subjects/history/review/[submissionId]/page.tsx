import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function HistorySubmissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey={subjectKey}
    />
  );
}
