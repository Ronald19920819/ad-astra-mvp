import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";

export default function AfrikaansSubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey="afrikaans"
    />
  );
}
