import "server-only";

import {
  getAuthenticatedLearnerProfile,
} from "@/lib/supabase/learnerProfile";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveCurrentTopicTitle } from "@/lib/subjects/currentTopic";
import {
  getSubjectConfigurationByDatabaseId,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

export type LearnerSubjectCardData = {
  subjectId: string;
  subjectKey: SubjectKey;
  approvedStatusLabel: "Active";
  currentTopic: string | null;
};

type SubjectLessonTopicRow = {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
  topic:
    | {
        title: string;
      }
    | {
        title: string;
      }[]
    | null;
};

export async function getAuthenticatedLearnerSubjectCards() {
  const profile = await getAuthenticatedLearnerProfile();

  if (!profile) {
    return {
      profile: null,
      subjectCards: [] as LearnerSubjectCardData[],
    };
  }

  const approvedSubjectIds = profile.approvedSubjects.map((subject) => subject.id);
  const subjectTopicMap = new Map<string, string | null>();

  if (approvedSubjectIds.length > 0) {
    const admin = createSupabaseAdminClient();
    const { data: lessonRows, error: lessonError } = await admin
      .from("lessons")
      .select(
        `
        id,
        subject_id,
        title,
        created_at,
        topic:subject_topics!lessons_topic_subject_fkey(title)
        `,
      )
      .eq("status", "published")
      .in("subject_id", approvedSubjectIds)
      .order("created_at", { ascending: false });

    if (lessonError) throw lessonError;

    for (const lesson of (lessonRows ?? []) as SubjectLessonTopicRow[]) {
      if (subjectTopicMap.has(lesson.subject_id)) continue;
      const topic = Array.isArray(lesson.topic) ? lesson.topic[0] : lesson.topic;
      subjectTopicMap.set(
        lesson.subject_id,
        resolveCurrentTopicTitle({
          topicTitle: topic?.title,
          lessonTitle: lesson.title,
        }),
      );
    }
  }

  const subjectCards = profile.approvedSubjects
    .map((subject) => {
      const configuration = getSubjectConfigurationByDatabaseId(subject.id);
      if (!configuration) return null;

      return {
        subjectId: subject.id,
        subjectKey: configuration.key,
        approvedStatusLabel: "Active" as const,
        currentTopic: subjectTopicMap.get(subject.id) ?? null,
      };
    })
    .filter(
      (
        subjectCard,
      ): subjectCard is LearnerSubjectCardData => Boolean(subjectCard),
    );

  return {
    profile,
    subjectCards,
  };
}
