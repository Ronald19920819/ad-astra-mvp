import "server-only";

import { isLearnerActivitySubmittedStatus } from "@/lib/activities/learnerActivityStatus";
import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import {
  getLearnerSupportStatus,
  type LearnerSupportStatus,
} from "@/lib/teachers/learnerSupport";
import type { AuthenticatedTeacherProfile } from "@/lib/teachers/teacherProfile";
import { buildSubjectRoute, getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type EnrolmentRow = {
  subject_id: string;
  learner_profile_id: string;
};

type LearnerProfileRow = {
  id: string;
  profile_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
};

type LessonRow = {
  id: string;
  subject_id: string;
  expected_completion_date: string | null;
};

type MaterialRow = {
  id: string;
  lesson_id: string;
};

type ActivityRow = {
  id: string;
  lesson_material_id: string;
  due_date: string | null;
};

type SubmissionRow = {
  activity_id: string;
  learner_id: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
};

type CompletionRow = {
  lesson_id: string;
  learner_id: string;
};

export type TeacherDashboardPriorityAction = {
  category: "at_risk" | "needs_support" | "awaiting_review";
  subjectId: string;
  subjectName: string;
  description: string;
  href: string;
};

export type TeacherDashboardLearnerInsight = {
  kind: "highest_overdue_burden" | "overdue_cohort";
  subjectId: string;
  subjectName: string;
  message: string;
};

export type TeacherDashboardInsights = {
  priorityActions: TeacherDashboardPriorityAction[];
  learnerInsights: TeacherDashboardLearnerInsight[];
};

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function authLessonKey(lessonId: string, learnerAuthUserId: string) {
  return `${lessonId}:${learnerAuthUserId}`;
}

function authActivityKey(activityId: string, learnerAuthUserId: string) {
  return `${activityId}:${learnerAuthUserId}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function supportDescription(status: LearnerSupportStatus, count: number) {
  if (status === "At Risk") {
    return `${pluralize(count, "learner")} ${count === 1 ? "is" : "are"} at risk`;
  }

  return `${pluralize(count, "learner")} ${count === 1 ? "needs" : "need"} support`;
}

function toActionRank(category: TeacherDashboardPriorityAction["category"]) {
  switch (category) {
    case "at_risk":
      return 0;
    case "needs_support":
      return 1;
    case "awaiting_review":
      return 2;
  }
}

export async function getTeacherDashboardInsights(
  teacherProfile: AuthenticatedTeacherProfile,
): Promise<TeacherDashboardInsights> {
  const subjectIds = teacherProfile.assignedSubjects.map((subject) => subject.id);
  if (subjectIds.length === 0) {
    return {
      priorityActions: [],
      learnerInsights: [],
    };
  }

  const admin = createSupabaseAdminClient();

  let { data: enrolmentData, error: enrolmentError } = await admin
    .from("learner_subjects")
    .select("subject_id, learner_profile_id")
    .in("subject_id", subjectIds)
    .eq("status", "approved")
    .eq("is_active", true);

  if (isMissingColumnError(enrolmentError)) {
    const fallback = await admin
      .from("learner_subjects")
      .select("subject_id, learner_profile_id")
      .in("subject_id", subjectIds)
      .eq("status", "approved");
    enrolmentData = fallback.data;
    enrolmentError = fallback.error;
  }

  if (enrolmentError) throw enrolmentError;

  const enrolments = (enrolmentData ?? []) as EnrolmentRow[];
  const activeLearnerProfileIds = [...new Set(enrolments.map((row) => row.learner_profile_id))];

  if (activeLearnerProfileIds.length === 0) {
    return {
      priorityActions: [],
      learnerInsights: [],
    };
  }

  const [learnerProfilesResult, lessonsResult] = await Promise.all([
    admin
      .from("learner_profiles")
      .select("id, profile_id, status")
      .eq("status", "active")
      .in("id", activeLearnerProfileIds),
    admin
      .from("lessons")
      .select("id, subject_id, expected_completion_date")
      .in("subject_id", subjectIds)
      .eq("status", "published"),
  ]);

  if (learnerProfilesResult.error) throw learnerProfilesResult.error;
  if (lessonsResult.error) throw lessonsResult.error;

  const learnerProfiles = (learnerProfilesResult.data ?? []) as LearnerProfileRow[];
  const activeProfileIds = learnerProfiles.map((row) => row.profile_id);

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("id, auth_user_id")
    .in("id", activeProfileIds)
    .eq("role", "learner");

  if (profileError) throw profileError;

  const profiles = (profileData ?? []) as ProfileRow[];
  const authUserIdByProfileId = new Map(profiles.map((row) => [row.id, row.auth_user_id]));
  const authUserIdByLearnerProfileId = new Map(
    learnerProfiles.flatMap((row) => {
      const authUserId = authUserIdByProfileId.get(row.profile_id);
      return authUserId ? [[row.id, authUserId] as const] : [];
    }),
  );

  const activeEnrolments = enrolments.filter((row) => authUserIdByLearnerProfileId.has(row.learner_profile_id));
  const activeAuthUserIds = [...new Set(activeEnrolments.flatMap((row) => {
    const authUserId = authUserIdByLearnerProfileId.get(row.learner_profile_id);
    return authUserId ? [authUserId] : [];
  }))];

  const lessons = (lessonsResult.data ?? []) as LessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  const [materialsResult, completionsResult] = await Promise.all([
    lessonIds.length > 0
      ? admin.from("lesson_materials").select("id, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length > 0 && activeAuthUserIds.length > 0
      ? admin
          .from("learner_lesson_completions")
          .select("lesson_id, learner_id")
          .in("lesson_id", lessonIds)
          .in("learner_id", activeAuthUserIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (materialsResult.error) throw materialsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const completions = (completionsResult.data ?? []) as CompletionRow[];
  const materialIds = materials.map((material) => material.id);

  const [activitiesResult] = await Promise.all([
    materialIds.length > 0
      ? admin
          .from("activities")
          .select("id, lesson_material_id, due_date")
          .in("lesson_material_id", materialIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (activitiesResult.error) throw activitiesResult.error;

  const activities = (activitiesResult.data ?? []) as ActivityRow[];
  const activityIds = activities.map((activity) => activity.id);

  const { data: submissionData, error: submissionError } =
    activityIds.length > 0 && activeAuthUserIds.length > 0
      ? await admin
          .from("activity_submissions")
          .select("activity_id, learner_id, status")
          .in("activity_id", activityIds)
          .in("learner_id", activeAuthUserIds)
      : { data: [], error: null };

  if (submissionError) throw submissionError;

  const submissions = (submissionData ?? []) as SubmissionRow[];

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const lessonIdByMaterialId = new Map(materials.map((material) => [material.id, material.lesson_id]));
  const subjectByActivityId = new Map<string, string>();

  for (const activity of activities) {
    const lessonId = lessonIdByMaterialId.get(activity.lesson_material_id);
    const lesson = lessonId ? lessonById.get(lessonId) : null;
    if (lesson) subjectByActivityId.set(activity.id, lesson.subject_id);
  }

  const completedLessonKeys = new Set(
    completions.map((completion) => authLessonKey(completion.lesson_id, completion.learner_id)),
  );
  const submittedActivityKeys = new Set(
    submissions
      .filter((submission) => isLearnerActivitySubmittedStatus(submission.status))
      .map((submission) => authActivityKey(submission.activity_id, submission.learner_id)),
  );

  const subjectStats = new Map(
    teacherProfile.assignedSubjects.map((subject) => [
      subject.id,
      {
        subjectId: subject.id,
        subjectName: subject.name,
        cohortSize: 0,
        onTrackCount: 0,
        needsSupportCount: 0,
        atRiskCount: 0,
        totalOverdueItems: 0,
        awaitingReviewCount: 0,
      },
    ]),
  );

  for (const submission of submissions) {
    if (
      submission.status !== "submitted" &&
      submission.status !== "marking_failed" &&
      submission.status !== "awaiting_review"
    ) {
      continue;
    }

    const subjectId = subjectByActivityId.get(submission.activity_id);
    if (!subjectId) continue;
    const current = subjectStats.get(subjectId);
    if (!current) continue;
    current.awaitingReviewCount += 1;
  }

  const lessonsBySubject = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    lessonsBySubject.set(lesson.subject_id, [
      ...(lessonsBySubject.get(lesson.subject_id) ?? []),
      lesson,
    ]);
  }

  const activitiesBySubject = new Map<string, ActivityRow[]>();
  for (const activity of activities) {
    const subjectId = subjectByActivityId.get(activity.id);
    if (!subjectId) continue;
    activitiesBySubject.set(subjectId, [
      ...(activitiesBySubject.get(subjectId) ?? []),
      activity,
    ]);
  }

  const activeLearnersBySubject = new Map<string, Set<string>>();
  for (const enrolment of activeEnrolments) {
    const current = activeLearnersBySubject.get(enrolment.subject_id) ?? new Set<string>();
    current.add(enrolment.learner_profile_id);
    activeLearnersBySubject.set(enrolment.subject_id, current);
  }

  for (const [subjectId, learnerIds] of activeLearnersBySubject.entries()) {
    const stat = subjectStats.get(subjectId);
    if (!stat) continue;

    const subjectLessons = lessonsBySubject.get(subjectId) ?? [];
    const subjectActivities = activitiesBySubject.get(subjectId) ?? [];

    stat.cohortSize = learnerIds.size;

    for (const learnerProfileId of learnerIds) {
      const learnerAuthUserId = authUserIdByLearnerProfileId.get(learnerProfileId);
      if (!learnerAuthUserId) continue;

      let overdueItemCount = 0;

      for (const lesson of subjectLessons) {
        const lessonComplete = completedLessonKeys.has(
          authLessonKey(lesson.id, learnerAuthUserId),
        );
        if (!lessonComplete && isDateOverdue(lesson.expected_completion_date)) {
          overdueItemCount += 1;
        }
      }

      for (const activity of subjectActivities) {
        const submitted = submittedActivityKeys.has(
          authActivityKey(activity.id, learnerAuthUserId),
        );
        if (!submitted && isDateOverdue(activity.due_date)) {
          overdueItemCount += 1;
        }
      }

      stat.totalOverdueItems += overdueItemCount;
      const supportStatus = getLearnerSupportStatus(overdueItemCount);
      if (supportStatus === "At Risk") {
        stat.atRiskCount += 1;
      } else if (supportStatus === "Needs Support") {
        stat.needsSupportCount += 1;
      } else {
        stat.onTrackCount += 1;
      }
    }
  }

  const priorityActions: TeacherDashboardPriorityAction[] = [];

  for (const stat of subjectStats.values()) {
    const subjectConfig = getSubjectConfigurationByDatabaseId(stat.subjectId);
    if (!subjectConfig) continue;

    if (stat.atRiskCount > 0) {
      priorityActions.push({
        category: "at_risk",
        subjectId: stat.subjectId,
        subjectName: stat.subjectName,
        description: supportDescription("At Risk", stat.atRiskCount),
        href: buildSubjectRoute(subjectConfig, "teacherLearners"),
      });
    }

    if (stat.needsSupportCount > 0) {
      priorityActions.push({
        category: "needs_support",
        subjectId: stat.subjectId,
        subjectName: stat.subjectName,
        description: supportDescription("Needs Support", stat.needsSupportCount),
        href: buildSubjectRoute(subjectConfig, "teacherLearners"),
      });
    }

    if (stat.awaitingReviewCount > 0) {
      priorityActions.push({
        category: "awaiting_review",
        subjectId: stat.subjectId,
        subjectName: stat.subjectName,
        description: `${pluralize(stat.awaitingReviewCount, "submission")} awaiting review`,
        href: buildSubjectRoute(subjectConfig, "teacherReview"),
      });
    }
  }

  priorityActions.sort((actionA, actionB) => {
    const rankDifference = toActionRank(actionA.category) - toActionRank(actionB.category);
    if (rankDifference !== 0) return rankDifference;

    const countA = Number(actionA.description.match(/^(\d+)/)?.[1] ?? 0);
    const countB = Number(actionB.description.match(/^(\d+)/)?.[1] ?? 0);
    if (countA !== countB) return countB - countA;

    return actionA.subjectName.localeCompare(actionB.subjectName);
  });

  const learnerInsights: TeacherDashboardLearnerInsight[] = [];
  const stats = [...subjectStats.values()].filter((stat) => stat.cohortSize > 0);

  const highestOverdueSubject = [...stats]
    .filter((stat) => stat.totalOverdueItems > 0)
    .sort((a, b) => {
      if (a.totalOverdueItems !== b.totalOverdueItems) {
        return b.totalOverdueItems - a.totalOverdueItems;
      }
      return a.subjectName.localeCompare(b.subjectName);
    })[0];

  if (highestOverdueSubject) {
    learnerInsights.push({
      kind: "highest_overdue_burden",
      subjectId: highestOverdueSubject.subjectId,
      subjectName: highestOverdueSubject.subjectName,
      message: `${highestOverdueSubject.subjectName} currently has the most overdue learning items.`,
    });
  }

  const overdueCohortSubject = [...stats]
    .filter((stat) => stat.totalOverdueItems > 0)
    .sort((a, b) => {
      const overdueLearnerCountA = a.cohortSize - a.onTrackCount;
      const overdueLearnerCountB = b.cohortSize - b.onTrackCount;
      const ratioA = overdueLearnerCountA / a.cohortSize;
      const ratioB = overdueLearnerCountB / b.cohortSize;
      if (ratioA !== ratioB) return ratioB - ratioA;
      if (overdueLearnerCountA !== overdueLearnerCountB) {
        return overdueLearnerCountB - overdueLearnerCountA;
      }
      return a.subjectName.localeCompare(b.subjectName);
    })[0];

  if (overdueCohortSubject) {
    const overdueLearnerCount = overdueCohortSubject.cohortSize - overdueCohortSubject.onTrackCount;
    learnerInsights.push({
      kind: "overdue_cohort",
      subjectId: overdueCohortSubject.subjectId,
      subjectName: overdueCohortSubject.subjectName,
      message: `${overdueLearnerCount} of ${overdueCohortSubject.cohortSize} ${overdueLearnerCount === 1 ? "learner" : "learners"} currently ${overdueLearnerCount === 1 ? "has" : "have"} overdue learning items in ${overdueCohortSubject.subjectName}.`,
    });
  }

  const deduplicatedInsights = learnerInsights.filter(
    (insight, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.kind === insight.kind &&
          candidate.subjectId === insight.subjectId &&
          candidate.message === insight.message,
      ) === index,
  );

  return {
    priorityActions: priorityActions.slice(0, 3),
    learnerInsights: deduplicatedInsights.slice(0, 3),
  };
}
