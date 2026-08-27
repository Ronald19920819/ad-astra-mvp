import "server-only";

import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";
import {
  isLearnerActivitySubmittedStatus,
  type LearnerActivitySubmissionStatus,
} from "@/lib/activities/learnerActivityStatus";
import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import {
  isLessonCompletionLate,
  isVideoProgressComplete,
} from "@/lib/lessons/adaptiveLessonCompletion";
import { hasPassedLessonQuiz } from "@/lib/lessons/lessonAssessment";
import {
  authorizeTeacher,
  businessStudiesSubjectId,
} from "@/lib/supabase/teacherAuth";

export type TrackerContentState =
  | "complete"
  | "partial"
  | "not_started"
  | "unavailable";

export type TrackerLessonStatus = "Complete" | "Late" | "Incomplete" | "Overdue";

export type LearningTrackerLearner = {
  learnerProfileId: string;
  name: string;
  video: TrackerContentState;
  reading: TrackerContentState;
  quiz: TrackerContentState;
  status: TrackerLessonStatus;
  overdueItemCount: number;
  submittedActivityCount: number;
  lastActiveAt: string | null;
};

export type LearningTrackerLesson = {
  id: string;
  lessonNumber: string;
  title: string;
  termNumber: number | null;
  weekNumber: number | null;
  displayOrder: number | null;
  expectedCompletionDate: string | null;
  activityCount: number;
  learners: LearningTrackerLearner[];
};

type LessonRow = {
  id: string;
  lesson_number: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  display_order: number | null;
  expected_completion_date: string | null;
};

type MaterialRow = { id: string; lesson_id: string; material_type: string };
type ProgressRow = {
  learner_profile_id: string;
  lesson_id: string;
  video_started_at: string | null;
  video_progress_percent: number | string;
  video_updated_at: string | null;
  reading_completed_at: string | null;
  last_engaged_at: string;
};
type QuizAttemptRow = {
  learner_id: string;
  lesson_id: string;
  passed: boolean;
  quiz_score: number;
  quiz_total: number;
  created_at: string;
  completed_at: string | null;
};
type CompletionRow = { learner_id: string; lesson_id: string; completed_at: string };
type ActivityRow = { id: string; lesson_material_id: string; due_date: string | null };
type ActivitySubmissionRow = {
  activity_id: string;
  learner_id: string;
  status: LearnerActivitySubmissionStatus;
  submitted_at: string;
};
type ProfileRow = { id: string; auth_user_id: string; full_name: string };
type LearnerProfileRow = { id: string; profile_id: string; status: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function getLearningTrackerErrorDetails(error: unknown) {
  if (isRecord(error)) {
    const isSupabaseError =
      typeof error.code === "string" ||
      typeof error.details === "string" ||
      typeof error.hint === "string";

    if (isSupabaseError) {
      return {
        message:
          typeof error.message === "string"
            ? error.message
            : "Unknown Supabase error",
        code: typeof error.code === "string" ? error.code : null,
        details: typeof error.details === "string" ? error.details : null,
        hint: typeof error.hint === "string" ? error.hint : null,
        stack:
          error instanceof Error
            ? error.stack
            : typeof error.stack === "string"
              ? error.stack
              : null,
      };
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    name: "UnknownError",
    message:
      typeof error === "string"
        ? error
        : "A non-Error value was thrown.",
    stack: null,
  };
}

function logSupabaseQueryError(context: string, error: unknown) {
  console.error(
    `[Subject learning tracker] ${context}:`,
    getLearningTrackerErrorDetails(error),
  );
}

function rethrowSupabaseQueryError(context: string, error: unknown): never {
  logSupabaseQueryError(context, error);
  throw error;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
}

function lessonLearnerKey(lessonId: string, learnerId: string) {
  return `${lessonId}:${learnerId}`;
}

function pushGroupedValue<T>(
  map: Map<string, T[]>,
  key: string,
  value: T,
) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export async function getSubjectLearningTracker(
  subjectId: string,
): Promise<LearningTrackerLesson[]> {
  let authorization: Awaited<ReturnType<typeof authorizeTeacher>>;

  try {
    authorization = await authorizeTeacher(subjectId);
  } catch (error) {
    rethrowSupabaseQueryError("teacher authorization failed", error);
  }

  if (!authorization.success) throw new Error(authorization.error);

  const supabase = authorization.teacher.admin;
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select(
      "id, lesson_number, title, term_number, week_number, display_order, expected_completion_date",
    )
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .order("term_number", { ascending: false })
    .order("week_number", { ascending: false })
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("lesson_number", { ascending: true });

  if (lessonError) rethrowSupabaseQueryError("published lessons query failed", lessonError);

  const lessons = (lessonData ?? []) as LessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);
  if (lessonIds.length === 0) return [];

  const [materialsResult, progressResult, attemptsResult, completionsResult] =
    await Promise.all([
      supabase
        .from("lesson_materials")
        .select("id, lesson_id, material_type")
        .in("lesson_id", lessonIds)
        .order("display_order", { ascending: true }),
      supabase
        .from("learner_lesson_progress")
        .select(
          "learner_profile_id, lesson_id, video_started_at, video_progress_percent, video_updated_at, reading_completed_at, last_engaged_at",
        )
        .in("lesson_id", lessonIds),
      supabase
        .from("learner_quiz_attempts")
        .select(
          "learner_id, lesson_id, passed, quiz_score, quiz_total, created_at, completed_at",
        )
        .in("lesson_id", lessonIds),
      supabase
        .from("learner_lesson_completions")
        .select("learner_id, lesson_id, completed_at")
        .in("lesson_id", lessonIds),
    ]);

  const trackerQueryErrors = [
    { context: "lesson materials query failed", error: materialsResult.error },
    { context: "lesson progress query failed", error: progressResult.error },
    { context: "quiz attempts query failed", error: attemptsResult.error },
    { context: "lesson completions query failed", error: completionsResult.error },
  ].filter(
    (result): result is { context: string; error: NonNullable<typeof result.error> } =>
      Boolean(result.error),
  );

  for (const result of trackerQueryErrors) {
    logSupabaseQueryError(result.context, result.error);
  }

  if (trackerQueryErrors[0]) throw trackerQueryErrors[0].error;

  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const progressRows = (progressResult.data ?? []) as ProgressRow[];
  const attempts = (attemptsResult.data ?? []) as QuizAttemptRow[];
  const completions = (completionsResult.data ?? []) as CompletionRow[];
  // Only reading/activity-type materials can back a genuine learner
  // activity -- quiz-type materials have their own `activities` row
  // internally, but a learner can never submit to it (quizzes are scored
  // via learner_quiz_attempts), so it must be excluded here or every
  // activity total/completion count below is inflated by one phantom,
  // permanently-unfulfillable "activity" per quiz.
  const materialIds = filterActivityBackedMaterialIds(materials);
  let activities: ActivityRow[] = [];
  let activitySubmissions: ActivitySubmissionRow[] = [];

  if (materialIds.length > 0) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, lesson_material_id, due_date")
      .in("lesson_material_id", materialIds);
    if (error) rethrowSupabaseQueryError("linked activities query failed", error);
    activities = (data ?? []) as ActivityRow[];
  }

  if (activities.length > 0) {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select("activity_id, learner_id, status, submitted_at")
      .in(
        "activity_id",
        activities.map((activity) => activity.id),
      );
    if (error) rethrowSupabaseQueryError("activity submissions query failed", error);
    activitySubmissions = (data ?? []) as ActivitySubmissionRow[];
  }

  let { data: enrolments, error: enrolmentsError } = await supabase
    .from("learner_subjects")
    .select("learner_profile_id")
    .eq("subject_id", subjectId)
    .eq("status", "approved")
    .eq("is_active", true);

  if (
    enrolmentsError?.code === "42703" ||
    enrolmentsError?.code === "PGRST204"
  ) {
    const fallback = await supabase
      .from("learner_subjects")
      .select("learner_profile_id")
      .eq("subject_id", subjectId);
    enrolments = fallback.data;
    enrolmentsError = fallback.error;
  }
  if (enrolmentsError) {
    rethrowSupabaseQueryError("subject enrolments query failed", enrolmentsError);
  }

  const currentLearnerProfileIds = [
    ...new Set(
      (enrolments ?? []).map((enrolment) => enrolment.learner_profile_id),
    ),
  ];
  let learnerProfiles: LearnerProfileRow[] = [];
  let profiles: ProfileRow[] = [];

  if (currentLearnerProfileIds.length > 0) {
    const { data: learnerData, error: learnerError } = await supabase
      .from("learner_profiles")
      .select("id, profile_id, status")
      .eq("status", "active")
      .in("id", currentLearnerProfileIds);

    if (learnerError) {
      rethrowSupabaseQueryError("active learner profiles query failed", learnerError);
    }

    learnerProfiles = (learnerData ?? []) as LearnerProfileRow[];
  }

  const profileIdsToLoad = learnerProfiles.map((profile) => profile.profile_id);

  if (profileIdsToLoad.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, auth_user_id, full_name")
      .eq("role", "learner")
      .in("id", profileIdsToLoad);

    if (profileError) {
      rethrowSupabaseQueryError("learner identity profiles query failed", profileError);
    }

    profiles = (profileData ?? []) as ProfileRow[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const identityByLearnerProfileId = new Map(
    learnerProfiles.flatMap((learnerProfile) => {
      const profile = profileById.get(learnerProfile.profile_id);
      return profile
        ? [[learnerProfile.id, { learnerProfile, profile }] as const]
        : [];
    }),
  );
  const cohort = [...identityByLearnerProfileId.values()].sort((a, b) =>
    a.profile.full_name.localeCompare(b.profile.full_name),
  );

  const materialsByLesson = new Map<string, MaterialRow[]>();
  const materialLessonIds = new Map<string, string>();
  for (const material of materials) {
    materialLessonIds.set(material.id, material.lesson_id);
    materialsByLesson.set(material.lesson_id, [
      ...(materialsByLesson.get(material.lesson_id) ?? []),
      material,
    ]);
  }

  const activitiesByLesson = new Map<string, ActivityRow[]>();
  for (const activity of activities) {
    const lessonId = materialLessonIds.get(activity.lesson_material_id);
    if (!lessonId) continue;
    activitiesByLesson.set(lessonId, [
      ...(activitiesByLesson.get(lessonId) ?? []),
      activity,
    ]);
  }

  const progressByLessonLearner = new Map<string, ProgressRow>();
  for (const progress of progressRows) {
    progressByLessonLearner.set(
      lessonLearnerKey(progress.lesson_id, progress.learner_profile_id),
      progress,
    );
  }

  const attemptsByLessonLearner = new Map<string, QuizAttemptRow[]>();
  for (const attempt of attempts) {
    pushGroupedValue(
      attemptsByLessonLearner,
      lessonLearnerKey(attempt.lesson_id, attempt.learner_id),
      attempt,
    );
  }

  const completionsByLessonLearner = new Map<string, CompletionRow[]>();
  for (const completion of completions) {
    pushGroupedValue(
      completionsByLessonLearner,
      lessonLearnerKey(completion.lesson_id, completion.learner_id),
      completion,
    );
  }

  const submissionsByActivityLearner = new Map<string, ActivitySubmissionRow[]>();
  for (const submission of activitySubmissions) {
    pushGroupedValue(
      submissionsByActivityLearner,
      lessonLearnerKey(submission.activity_id, submission.learner_id),
      submission,
    );
  }

  return lessons.map((lesson) => {
    const lessonMaterials = materialsByLesson.get(lesson.id) ?? [];
    const lessonActivities = activitiesByLesson.get(lesson.id) ?? [];
    const hasVideo = lessonMaterials.some((material) => material.material_type === "video");
    const hasReading = lessonMaterials.some((material) => material.material_type === "reading");
    const hasQuiz = lessonMaterials.some((material) => material.material_type === "quiz");

    const learners = cohort.map(({ learnerProfile, profile }) => {
      const progress = progressByLessonLearner.get(
        lessonLearnerKey(lesson.id, learnerProfile.id),
      );
      const learnerAttempts = attemptsByLessonLearner.get(
        lessonLearnerKey(lesson.id, profile.auth_user_id),
      ) ?? [];
      const learnerCompletions = completionsByLessonLearner.get(
        lessonLearnerKey(lesson.id, profile.auth_user_id),
      ) ?? [];
      const submittedActivityIds = new Set(
        lessonActivities.flatMap((activity) => {
          const submissions = submissionsByActivityLearner.get(
            lessonLearnerKey(activity.id, profile.auth_user_id),
          ) ?? [];
          return submissions.some((submission) =>
            isLearnerActivitySubmittedStatus(submission.status),
          )
            ? [activity.id]
            : [];
        }),
      );
      const learnerActivitySubmissions = lessonActivities.flatMap(
        (activity) =>
          submissionsByActivityLearner.get(
            lessonLearnerKey(activity.id, profile.auth_user_id),
          ) ?? [],
      );
      const videoPercentage = Number(progress?.video_progress_percent ?? 0);
      const quizCompleted = learnerAttempts.length > 0;
      const quizSuccessful = learnerAttempts.some((attempt) =>
        hasPassedLessonQuiz(attempt.quiz_score, attempt.quiz_total),
      );
      const video: TrackerContentState = !hasVideo
        ? "unavailable"
        : isVideoProgressComplete(videoPercentage)
          ? "complete"
          : progress?.video_started_at
            ? "partial"
            : "not_started";
      // Reading completion is the genuine persisted signal
      // (learner_lesson_progress.reading_completed_at) OR a passed quiz --
      // product decision: for a lesson with both a reading and a quiz, a
      // passed quiz is accepted evidence the learner engaged with the
      // reading, so the tracker never shows a contradictory "quiz passed /
      // reading incomplete" state. This mirrors the SAME rule now applied
      // canonically in lib/lessons/lessonCompletionService.ts's own signal
      // derivation (evaluateAdaptiveLessonCompletion itself stays generic
      // and unchanged) -- this tracker never writes reading_completed_at
      // itself, but the two are no longer independent judgments.
      const reading: TrackerContentState = !hasReading
        ? "unavailable"
        : progress?.reading_completed_at || quizSuccessful
          ? "complete"
          : "not_started";
      const quiz: TrackerContentState = !hasQuiz
        ? "unavailable"
        : quizSuccessful
          ? "complete"
          : quizCompleted
            ? "partial"
            : "not_started";
      const latestCompletion = learnerCompletions[0] ?? null;
      const isLessonComplete = latestCompletion !== null;
      const isLessonOverdue =
        !isLessonComplete &&
        isDateOverdue(lesson.expected_completion_date);
      const overdueActivityCount = lessonActivities.filter(
        (activity) =>
          isDateOverdue(activity.due_date) &&
          !submittedActivityIds.has(activity.id),
      ).length;
      // Locked rule: a complete lesson is never "Needs Attention"/Overdue,
      // even if it was completed after its expected date -- that's "Late",
      // a teacher-facing timing distinction, not an incompleteness signal.
      const status: TrackerLessonStatus = isLessonComplete
        ? isLessonCompletionLate(
            latestCompletion.completed_at,
            lesson.expected_completion_date,
          )
          ? "Late"
          : "Complete"
        : isLessonOverdue
          ? "Overdue"
          : "Incomplete";
      const lastActiveAt = latestTimestamp([
        progress?.last_engaged_at,
        progress?.video_updated_at,
        ...learnerAttempts.flatMap((attempt) => [attempt.created_at, attempt.completed_at]),
        ...learnerCompletions.map((completion) => completion.completed_at),
        ...learnerActivitySubmissions.map((submission) => submission.submitted_at),
      ]);

      return {
        learnerProfileId: learnerProfile.id,
        name: profile.full_name,
        video,
        reading,
        quiz,
        status,
        overdueItemCount: (isLessonOverdue ? 1 : 0) + overdueActivityCount,
        submittedActivityCount: submittedActivityIds.size,
        lastActiveAt,
      };
    });

    return {
      id: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      termNumber: lesson.term_number,
      weekNumber: lesson.week_number,
      displayOrder: lesson.display_order,
      expectedCompletionDate: lesson.expected_completion_date,
      activityCount: lessonActivities.length,
      learners,
    };
  });
}

export function getBusinessStudiesLearningTracker() {
  return getSubjectLearningTracker(businessStudiesSubjectId);
}


