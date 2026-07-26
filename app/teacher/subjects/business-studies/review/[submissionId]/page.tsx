import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";

export const dynamic = "force-dynamic";

export default function BusinessStudiesSubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey="business-studies"
    />
  );
}
