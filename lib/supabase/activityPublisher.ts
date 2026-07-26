import type { ActivityQuestion } from "@/components/activities/ActivityQuestionBuilder";
import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

type PublishActivityInput = {
  subjectId: string;
  activityId?: string;
  confirmedSubmissionImpact?: boolean;
  title: string;
  instructions: string;
  lessonId: string;
  totalMarks: number;
  dueDate: string;
  questions: ActivityQuestion[];
};

export async function publishActivityToSupabase({
  subjectId,
  activityId,
  confirmedSubmissionImpact = false,
  title,
  instructions,
  lessonId,
  totalMarks,
  dueDate,
  questions,
}: PublishActivityInput) {
  return teacherApiRequest<{ id: string }>(
    activityId
      ? `/api/teacher/business-studies/activities/${activityId}`
      : "/api/teacher/business-studies/activities",
    {
      method: activityId ? "PUT" : "POST",
      body: JSON.stringify({
        subjectId,
        confirmedSubmissionImpact,
        title,
        instructions,
        lessonId,
        totalMarks,
        dueDate,
        questions: questions.map((question) => ({
          questionId: question.databaseId,
          paper: question.paper,
          questionType: question.questionType,
          questionText: question.questionText,
          marks: Number(question.marks),
          ao: question.ao,
          guidance: question.guidance,
        })),
      }),
    },
  );
}
