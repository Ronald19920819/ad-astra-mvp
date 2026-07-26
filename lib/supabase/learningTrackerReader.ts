import "server-only";

import {
  authorizeTeacher,
  businessStudiesSubjectId,
} from "@/lib/supabase/teacherAuth";
import { hasPassedLessonQuiz } from "@/lib/lessons/lessonAssessment";

export type TrackerContentState =
  | "complete"
  | "partial"
  | "not_started"
  | "unavailable";

export type TrackerOverallStatus = "Complete" | "Needs Support" | "At Risk";

export type LearningTrackerLearner = {
  learnerProfileId: string;
  name: string;
  video: TrackerContentState;
  reading: TrackerContentState;
  quiz: TrackerContentState;
  status: TrackerOverallStatus;
  lastActiveAt: string | null;
};

export type LearningTrackerLesson = {
  id: string;
  lessonNumber: string;
  title: string;
  termNumber: number | null;
  weekNumber: number | null;
  displayOrder: number | null;
  learners: LearningTrackerLearner[];
};

type LessonRow = {
  id: string;
  lesson_number: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  display_order: number | null;
};

type MaterialRow = { id: string; lesson_id: string; material_type: string };
type ProgressRow = {
  learner_profile_id: string;
  lesson_id: string;
  video_started_at: string | null;
  video_progress_percent: number | string;
  video_updated_at: string | null;
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
type ActivityRow = { id: string; lesson_material_id: string };
type ActivitySubmissionRow = {
  activity_id: string;
  learner_id: string;
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

export async function getSubjectLearningTracker(
  subjectId: string,
): Promise<
  LearningTrackerLesson[]
> {
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
    .select("id, lesson_number, title, term_number, week_number, display_order")
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
          "learner_profile_id, lesson_id, video_started_at, video_progress_percent, video_updated_at, last_engaged_at",
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
  const materialIds = materials.map((material) => material.id);
  let activities: ActivityRow[] = [];
  let activitySubmissions: ActivitySubmissionRow[] = [];

  if (materialIds.length > 0) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, lesson_material_id")
      .in("lesson_material_id", materialIds);
    if (error) rethrowSupabaseQueryError("linked activities query failed", error);
    activities = (data ?? []) as ActivityRow[];
  }

  if (activities.length > 0) {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select("activity_id, learner_id, submitted_at")
      .in(
        "activity_id",
        activities.map((activity) => activity.id),
      );
    if (error) rethrowSupabaseQueryError("activity submissions query failed", error);
    activitySubmissions = (data ?? []) as ActivitySubmissionRow[];
  }

  const evidenceAuthUserIds = [
    ...new Set([
      ...attempts.map((attempt) => attempt.learner_id),
      ...completions.map((completion) => completion.learner_id),
      ...activitySubmissions.map((submission) => submission.learner_id),
    ]),
  ];
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
  const progressLearnerProfileIds = [
    ...new Set([
      ...progressRows.map((progress) => progress.learner_profile_id),
      ...(enrolments ?? []).map(
        (enrolment) => enrolment.learner_profile_id,
      ),
    ]),
  ];
  let learnerProfiles: LearnerProfileRow[] = [];
  let profiles: ProfileRow[] = [];

  if (progressLearnerProfileIds.length > 0) {
    const { data, error } = await supabase
      .from("learner_profiles")
      .select("id, profile_id, status")
      .eq("status", "active")
      .in("id", progressLearnerProfileIds);
    if (error) rethrowSupabaseQueryError("learner profiles by progress query failed", error);
    learnerProfiles = (data ?? []) as LearnerProfileRow[];
  }

  if (evidenceAuthUserIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, full_name")
      .eq("role", "learner")
      .in("auth_user_id", evidenceAuthUserIds);
    if (error) rethrowSupabaseQueryError("learner profiles by auth user query failed", error);
    profiles = (data ?? []) as ProfileRow[];
  }

  const profileIdsToLoad = [
    ...new Set([
      ...learnerProfiles.map((profile) => profile.profile_id),
      ...profiles.map((profile) => profile.id),
    ]),
  ];

  if (profileIdsToLoad.length > 0) {
    const [{ data: profileData, error: profileError }, { data: learnerData, error: learnerError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, auth_user_id, full_name")
          .eq("role", "learner")
          .in("id", profileIdsToLoad),
        supabase
          .from("learner_profiles")
          .select("id, profile_id, status")
          .eq("status", "active")
          .in("profile_id", profileIdsToLoad),
      ]);

    if (profileError) logSupabaseQueryError("learner identity profiles query failed", profileError);
    if (learnerError) logSupabaseQueryError("active learner profiles query failed", learnerError);
    if (profileError) throw profileError;
    if (learnerError) throw learnerError;

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    for (const profile of (profileData ?? []) as ProfileRow[]) profilesById.set(profile.id, profile);
    profiles = [...profilesById.values()];

    const learnersById = new Map(learnerProfiles.map((profile) => [profile.id, profile]));
    for (const learner of (learnerData ?? []) as LearnerProfileRow[]) learnersById.set(learner.id, learner);
    learnerProfiles = [...learnersById.values()];
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
  for (const material of materials) {
    materialsByLesson.set(material.lesson_id, [
      ...(materialsByLesson.get(material.lesson_id) ?? []),
      material,
    ]);
  }

  const activityLessonIds = new Map<string, string>();
  const materialLessonIds = new Map(materials.map((material) => [material.id, material.lesson_id]));
  for (const activity of activities) {
    const lessonId = materialLessonIds.get(activity.lesson_material_id);
    if (lessonId) activityLessonIds.set(activity.id, lessonId);
  }

  return lessons.map((lesson) => {
    const lessonMaterials = materialsByLesson.get(lesson.id) ?? [];
    const hasVideo = lessonMaterials.some((material) => material.material_type === "video");
    const hasReading = lessonMaterials.some((material) => material.material_type === "reading");
    const hasQuiz = lessonMaterials.some((material) => material.material_type === "quiz");

    const learners = cohort.map(({ learnerProfile, profile }) => {
      const progress = progressRows.find(
        (row) => row.lesson_id === lesson.id && row.learner_profile_id === learnerProfile.id,
      );
      const learnerAttempts = attempts.filter(
        (attempt) => attempt.lesson_id === lesson.id && attempt.learner_id === profile.auth_user_id,
      );
      const learnerCompletions = completions.filter(
        (completion) => completion.lesson_id === lesson.id && completion.learner_id === profile.auth_user_id,
      );
      const learnerActivitySubmissions = activitySubmissions.filter(
        (submission) =>
          submission.learner_id === profile.auth_user_id &&
          activityLessonIds.get(submission.activity_id) === lesson.id,
      );
      const videoPercentage = Number(progress?.video_progress_percent ?? 0);
      const quizCompleted = learnerAttempts.length > 0;
      const quizSuccessful = learnerAttempts.some((attempt) =>
        hasPassedLessonQuiz(attempt.quiz_score, attempt.quiz_total),
      );
      const video: TrackerContentState = !hasVideo
        ? "unavailable"
        : videoPercentage >= 90
          ? "complete"
          : progress?.video_started_at
            ? "partial"
            : "not_started";
      const reading: TrackerContentState = !hasReading
        ? "unavailable"
        : quizSuccessful
          ? "complete"
          : "not_started";
      const quiz: TrackerContentState = !hasQuiz
        ? "unavailable"
        : quizCompleted
          ? "complete"
          : "not_started";
      const attachedCompletion = [
        ...(hasVideo ? [video === "complete"] : []),
        ...(hasReading ? [reading === "complete"] : []),
        ...(hasQuiz ? [quizSuccessful] : []),
      ];
      const isComplete = attachedCompletion.every(Boolean);
      const hasEngaged = Boolean(
        progress || learnerAttempts.length || learnerCompletions.length || learnerActivitySubmissions.length,
      );
      const status: TrackerOverallStatus = isComplete
        ? "Complete"
        : hasEngaged
          ? "Needs Support"
          : "At Risk";
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
      learners,
    };
  });
}

export function getBusinessStudiesLearningTracker() {
  return getSubjectLearningTracker(businessStudiesSubjectId);
}
