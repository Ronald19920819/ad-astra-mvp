import { teacherApiRequest } from "@/lib/supabase/teacherApiClient";

export type LessonTopic = {
  id: string;
  title: string;
};

export async function getLessonTopics(subjectId: string) {
  return teacherApiRequest<LessonTopic[]>(
    `/api/teacher/business-studies/topics?subjectId=${encodeURIComponent(subjectId)}`,
    { method: "GET" },
  );
}

export async function createLessonTopic(subjectId: string, title: string) {
  return teacherApiRequest<LessonTopic>(
    "/api/teacher/business-studies/topics",
    {
      method: "POST",
      body: JSON.stringify({ subjectId, title }),
    },
  );
}
