import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";

export default function HistorySubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey="history"
    />
  );
}
