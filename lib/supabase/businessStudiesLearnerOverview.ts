import "server-only";

import { getLearnerActivityStatus } from "@/lib/activities/learnerActivityStatus";
import { getLessonLifecycle } from "@/lib/lessons/lessonLifecycle";
import {
  calculateSubjectProgress,
  getPerformanceLevel,
  type SubjectProgressCalculation,
} from "@/lib/progress/subjectProgress";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { businessStudiesSubject } from "@/lib/subjects/subjectConfig";
import {
  getSubjectNextAction,
  type SubjectNextAction,
} from "@/lib/subjects/learnerStatus";
import { resolveCurrentTopicTitle } from "@/lib/subjects/currentTopic";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";

export const businessStudiesSubjectId =
  businessStudiesSubject.databaseId;

type LessonRow = {
  id: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  expected_completion_date: string | null;
  created_at: string;
  topic:
    | { title: string }
    | { title: string }[]
    | null;
};

type MaterialRow = {
  id: string;
  lesson_id: string;
  material_type: string;
};

type ActivityRow = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  created_at: string;
  lesson_material_id: string;
};

type SubmissionRow = {
  activity_id: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
  submitted_at: string;
  final_mark: number | null;
  reviewed_at: string | null;
  original_total_marks: number | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

function isMissingSnapshotColumnError(
  error: { code?: string; message?: string } | null,
) {
  return (
    error?.code === "42703" &&
    (error.message?.includes("original_total_marks") ||
      error.message?.includes("activity_snapshot"))
  );
}

export type LearnerActivityPriority = {
  id: string;
  title: string;
  dueDate: string | null;
  applicableDate: string | null;
  isOverdue: boolean;
};

export type BusinessStudiesLearnerOverview = {
  progress: SubjectProgressCalculation;
  activityCompletion: {
    completedActivityCount: number;
    totalPublishedActivityCount: number;
  };
  latestMarkedActivity: {
    id: string;
    title: string;
    earnedMarks: number;
    availableMarks: number;
    percentage: number;
  } | null;
  currentTopic: string | null;
  currentActivity: LearnerActivityPriority | null;
  nextAction: SubjectNextAction;
  performanceLevel: ReturnType<typeof getPerformanceLevel>;
  status: "Overdue" | "Activity Due" | "Awaiting Feedback" | "Up to Date";
  nextTest: null;
};

export type SubjectLearnerOverview = BusinessStudiesLearnerOverview;

function lessonTopicTitle(lesson: LessonRow | null) {
  if (!lesson) return null;
  const topic = Array.isArray(lesson.topic) ? lesson.topic[0] : lesson.topic;
  return resolveCurrentTopicTitle({
    topicTitle: topic?.title,
    lessonTitle: lesson.title,
  });
}

export async function getSubjectLearnerOverview(
  learnerId: string,
  subjectId: string,
  now = new Date(),
): Promise<BusinessStudiesLearnerOverview> {
  const supabase = createSupabaseAdminClient();
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      id,
      title,
      term_number,
      week_number,
      expected_completion_date,
      created_at,
      topic:subject_topics!lessons_topic_subject_fkey(title)
      `,
    )
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (lessonError) throw lessonError;
  const lessons = (lessonData ?? []) as LessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  if (lessonIds.length === 0) {
    const progress = calculateSubjectProgress({
      markedActivities: [],
      completedLessonCount: 0,
      totalPublishedLessonCount: 0,
    });
    return {
      progress,
      activityCompletion: {
        completedActivityCount: 0,
        totalPublishedActivityCount: 0,
      },
      latestMarkedActivity: null,
      currentTopic: null,
      currentActivity: null,
      nextAction: "None",
      performanceLevel: getPerformanceLevel(null),
      status: "Up to Date",
      nextTest: null,
    };
  }

  const [completionResult, materialResult] = await Promise.all([
    supabase
      .from("learner_lesson_completions")
      .select("lesson_id")
      .eq("learner_id", learnerId)
      .in("lesson_id", lessonIds),
    supabase
      .from("lesson_materials")
      .select("id, lesson_id, material_type")
      .in("lesson_id", lessonIds),
  ]);

  if (completionResult.error) throw completionResult.error;
  if (materialResult.error) throw materialResult.error;

  const completedLessonIds = new Set(
    (completionResult.data ?? []).map((completion) => completion.lesson_id),
  );
  const materials = (materialResult.data ?? []) as MaterialRow[];
  const activityMaterialIds = materials
    .filter((material) => material.material_type !== "quiz")
    .map((material) => material.id);
  let activities: ActivityRow[] = [];

  if (activityMaterialIds.length > 0) {
    const { data, error } = await supabase
      .from("activities")
      .select(
        "id, title, total_marks, due_date, created_at, lesson_material_id",
      )
      .in("lesson_material_id", activityMaterialIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    activities = (data ?? []) as ActivityRow[];
  }

  let submissions: SubmissionRow[] = [];
  if (activities.length > 0) {
    let { data, error } = await supabase
      .from("activity_submissions")
      .select(
        "activity_id, status, submitted_at, final_mark, reviewed_at, original_total_marks, activity_snapshot",
      )
      .eq("learner_id", learnerId)
      .in(
        "activity_id",
        activities.map((activity) => activity.id),
      );

    if (isMissingSnapshotColumnError(error)) {
      const legacyResult = await supabase
        .from("activity_submissions")
        .select(
          "activity_id, status, submitted_at, final_mark, reviewed_at",
        )
        .eq("learner_id", learnerId)
        .in(
          "activity_id",
          activities.map((activity) => activity.id),
        );
      data = (legacyResult.data ?? []).map((submission) => ({
        ...submission,
        original_total_marks: null,
        activity_snapshot: null,
      })) as typeof data;
      error = legacyResult.error;
    }

    if (error) throw error;
    submissions = (data ?? []) as SubmissionRow[];
  }

  const activityById = new Map(
    activities.map((activity) => [activity.id, activity]),
  );
  const submittedTotal = (submission: SubmissionRow) =>
    submission.original_total_marks ??
    (isActivitySubmissionSnapshot(submission.activity_snapshot)
      ? submission.activity_snapshot.activity.totalMarks
      : activityById.get(submission.activity_id)?.total_marks ?? 0);
  const validMarkedSubmissions = submissions
    .filter((submission) => {
      const activity = activityById.get(submission.activity_id);
      return (
        submission.status === "returned" &&
        submission.final_mark !== null &&
        activity !== undefined &&
        submittedTotal(submission) > 0 &&
        submission.final_mark >= 0 &&
        submission.final_mark <= submittedTotal(submission)
      );
    })
    .sort(
      (submissionA, submissionB) =>
        new Date(
          submissionB.reviewed_at ?? submissionB.submitted_at,
        ).getTime() -
        new Date(
          submissionA.reviewed_at ?? submissionA.submitted_at,
        ).getTime(),
    );
  const progress = calculateSubjectProgress({
    markedActivities: validMarkedSubmissions.map((submission) => {
      return {
        earnedMarks: submission.final_mark!,
        availableMarks: submittedTotal(submission),
      };
    }),
    completedLessonCount: completedLessonIds.size,
    totalPublishedLessonCount: lessons.length,
  });

  const lifecycle = getLessonLifecycle(
    lessons.map((lesson) => ({
      id: lesson.id,
      created_at: lesson.created_at,
      expected_completion_date: lesson.expected_completion_date,
      isCompleted: completedLessonIds.has(lesson.id),
    })),
    now,
  );
  const currentLesson =
    lessons.find((lesson) => lesson.id === lifecycle.currentLessonId) ??
    lessons[0] ??
    null;
  const materialLessonIds = new Map(
    materials.map((material) => [material.id, material.lesson_id]),
  );
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const submissionByActivityId = new Map(
    submissions.map((submission) => [submission.activity_id, submission]),
  );
  const incompleteActivities = activities
    .filter((activity) => !submissionByActivityId.has(activity.id))
    .map((activity) => {
      const lessonId = materialLessonIds.get(activity.lesson_material_id);
      const lesson = lessonId ? lessonById.get(lessonId) : null;
      const activityStatus = getLearnerActivityStatus({
        submissionStatus: null,
        dueDate: activity.due_date,
        now,
      });
      const applicableDate =
        activity.due_date?.slice(0, 10) ??
        lesson?.expected_completion_date?.slice(0, 10) ??
        null;
      return {
        id: activity.id,
        title: activity.title,
        dueDate: activity.due_date?.slice(0, 10) ?? null,
        applicableDate,
        isOverdue: activityStatus === "not_submitted",
        createdAt: activity.created_at,
      };
    })
    .sort((activityA, activityB) => {
      if (activityA.isOverdue !== activityB.isOverdue) {
        return activityA.isOverdue ? -1 : 1;
      }
      if (activityA.applicableDate && activityB.applicableDate) {
        const dateOrder = activityA.applicableDate.localeCompare(
          activityB.applicableDate,
        );
        if (dateOrder !== 0) return dateOrder;
      } else if (activityA.applicableDate) {
        return -1;
      } else if (activityB.applicableDate) {
        return 1;
      }
      return (
        new Date(activityB.createdAt).getTime() -
        new Date(activityA.createdAt).getTime()
      );
    });
  const currentActivity = incompleteActivities[0] ?? null;
  const hasIncompleteLesson = completedLessonIds.size < lessons.length;
  const hasIncompleteActivity = incompleteActivities.length > 0;
  const nextAction = getSubjectNextAction({
    hasIncompleteLesson,
    hasIncompleteActivity,
  });
  const hasAwaitingFeedback = submissions.some(
    (submission) => submission.status !== "returned",
  );
  const status = incompleteActivities.some((activity) => activity.isOverdue)
    ? "Overdue"
    : incompleteActivities.length > 0
      ? "Activity Due"
      : hasAwaitingFeedback
        ? "Awaiting Feedback"
        : "Up to Date";
  const latestSubmission = validMarkedSubmissions[0];
  const latestActivity = latestSubmission
    ? activityById.get(latestSubmission.activity_id)
    : null;

  return {
    progress,
    activityCompletion: {
      completedActivityCount: submissionByActivityId.size,
      totalPublishedActivityCount: activities.length,
    },
    latestMarkedActivity:
      latestSubmission && latestActivity
        ? {
            id: latestActivity.id,
            title: isActivitySubmissionSnapshot(
              latestSubmission.activity_snapshot,
            )
              ? latestSubmission.activity_snapshot.activity.title
              : latestActivity.title,
            earnedMarks: latestSubmission.final_mark!,
            availableMarks: submittedTotal(latestSubmission),
            percentage:
              (latestSubmission.final_mark! /
                submittedTotal(latestSubmission)) *
              100,
          }
        : null,
    currentTopic: lessonTopicTitle(currentLesson),
    currentActivity,
    nextAction,
    performanceLevel: getPerformanceLevel(progress.activityAverage),
    status,
    nextTest: null,
  };
}

export function getBusinessStudiesLearnerOverview(
  learnerId: string,
  now = new Date(),
) {
  return getSubjectLearnerOverview(
    learnerId,
    businessStudiesSubjectId,
    now,
  );
}
