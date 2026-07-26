import { TeacherSubjectSubmissionReviewPage } from "@/components/subjects/TeacherSubjectSubmissionReviewPage";

export default function EnglishSubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  return (
    <TeacherSubjectSubmissionReviewPage
      params={params}
      subjectKey="english"
    />
  );
}
