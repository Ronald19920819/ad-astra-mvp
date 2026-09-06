import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getLearnerProfileByAuthUserId } from "@/lib/supabase/learnerProfile";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { resolveCurrentTopicTitle } from "@/lib/subjects/currentTopic";
import { isLessonCompletionLate } from "@/lib/lessons/adaptiveLessonCompletion";
import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";
import {
  isLearnerActivitySubmittedStatus,
  type LearnerActivitySubmissionStatus,
} from "@/lib/activities/learnerActivityStatus";
import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";
import {
  LEGACY_ACTIVITY_5_ID,
  deriveLegacyActivity5Window,
} from "@/lib/rewards/legacyActivity5Window";
import {
  LEGACY_ACTIVITY_2_ID,
  deriveLegacyActivity2Window,
} from "@/lib/rewards/legacyActivity2Window";
import { resolveActivityTiming } from "@/lib/reports/monthlyReportLateness";
import {
  calculateEngagementSummary,
  calculateEvidenceFlags,
  calculateReportAcademicSummary,
  calculateTopicBreakdown,
} from "@/lib/reports/monthlyReportCalculations";
import { calculateMonthlyReportBadge } from "@/lib/reports/monthlyReportBadge";
import {
  sortActivityEntriesByCurriculumOrder,
  sortLessonEntriesByCurriculumOrder,
} from "@/lib/reports/monthlyReportOrdering";
import {
  MONTHLY_REPORT_SCHEMA_VERSION,
  type MonthlyReportActivityEntry,
  type MonthlyReportLessonEntry,
  type MonthlyReportPayload,
} from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 1: the deterministic report
// engine. Read-only by design -- this file never writes to
// learner_lesson_completions, activity_submissions, or any other table it
// reads from. Lesson completion in particular is read directly from
// learner_lesson_completions (the canonical, already-persisted record of
// completion -- see lib/lessons/lessonCompletionService.ts's own
// upsert-once write path) rather than recomputed via
// evaluateAdaptiveLessonCompletion/evaluateAndPersistLessonCompletion,
// which exist specifically to CALCULATE-AND-PERSIST a completion the
// first time it happens. Calling that write path from report generation
// would risk report generation itself manufacturing a completion row
// (e.g. from a stale in-memory read of progress/quiz signals) purely as a
// side effect of previewing a report -- exactly what this stage's
// read-only requirement forbids. If a learner's true completion state
// hasn't yet been reconciled into learner_lesson_completions, that must
// happen through the lesson's own normal completion-triggering flow, not
// through report generation.

type LessonInfoRow = {
  id: string;
  lesson_number: string;
  title: string;
  topic_id: string | null;
  expected_completion_date: string | null;
};

type ActivityRow = {
  id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
  lesson_material_id: string;
};

type MaterialRow = { id: string; lesson_id: string; material_type: string };

type SubmissionRow = {
  activity_id: string;
  status: LearnerActivitySubmissionStatus;
  submitted_at: string;
  final_mark: number | null;
  original_total_marks: number | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

type CompletionRow = { lesson_id: string; completed_at: string };

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function findLegacyWindowEnd(
  supabase: SupabaseAdminClient,
  activityId: string,
  deriveWindow: (firstGenuineSubmissionAt: string) => { windowEnd: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select("status, submitted_at")
    .eq("activity_id", activityId)
    .order("submitted_at", { ascending: true });
  if (error) throw error;

  const firstGenuine = (data ?? []).find((row) =>
    isLearnerActivitySubmittedStatus(row.status as LearnerActivitySubmissionStatus),
  );
  if (!firstGenuine) return null;
  return deriveWindow(firstGenuine.submitted_at).windowEnd;
}

// teacher_id is profiles.id (matching the corrected reviewed_by
// convention -- see 202607210002_teacher_reviewed_by_profile.sql), so a
// direct, minimal profiles lookup is the safe, proportionate path here --
// mirroring the exact fallback order already used for this identical
// resolution in lib/email/reviewReturnEmail.ts's resolveTeacherFirstName,
// except this returns the fuller display name a report header needs
// rather than only a first name.
async function resolveTeacherDisplayName(
  supabase: SupabaseAdminClient,
  teacherId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, surname, full_name")
    .eq("id", teacherId)
    .maybeSingle();
  if (error || !data) return null;

  const fullName = data.full_name?.trim();
  if (fullName) return fullName;

  const composed = [data.first_name?.trim(), data.surname?.trim()]
    .filter(Boolean)
    .join(" ");
  return composed || null;
}

export async function generateMonthlyReportPreview({
  learnerId,
  subjectId,
  teacherId,
  reportMonth,
  selectedLessonIds,
  selectedActivityIds,
  now = new Date(),
}: {
  learnerId: string;
  subjectId: string;
  teacherId: string;
  reportMonth: string;
  selectedLessonIds: readonly string[];
  selectedActivityIds: readonly string[];
  now?: Date;
}): Promise<MonthlyReportPayload> {
  const supabase = createSupabaseAdminClient();
  const subject = getSubjectConfigurationByDatabaseId(subjectId);
  const learnerProfile = await getLearnerProfileByAuthUserId(learnerId);
  const teacherName = await resolveTeacherDisplayName(supabase, teacherId);

  let activities: ActivityRow[] = [];
  if (selectedActivityIds.length > 0) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, title, total_marks, due_date, lesson_material_id")
      .in("id", selectedActivityIds);
    if (error) throw error;
    activities = (data ?? []) as ActivityRow[];
  }

  const materialIds = [...new Set(activities.map((activity) => activity.lesson_material_id))];
  let materials: MaterialRow[] = [];
  if (materialIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_materials")
      .select("id, lesson_id, material_type")
      .in("id", materialIds);
    if (error) throw error;
    materials = (data ?? []) as MaterialRow[];
  }
  const materialById = new Map(materials.map((material) => [material.id, material]));
  // Excludes lesson-quiz-backed "activities" -- a learner can never
  // submit to those (they're scored via learner_quiz_attempts instead).
  const activityBackedMaterialIds = new Set(filterActivityBackedMaterialIds(materials));

  // A selected ACTIVITY's own lesson may not be among the teacher's
  // selected LESSONS (the two selections are independent) -- resolve the
  // union so every activity can still show its real lesson number/topic.
  const lessonIdsFromActivities = materials.map((material) => material.lesson_id);
  const allLessonIds = [...new Set([...selectedLessonIds, ...lessonIdsFromActivities])];

  let lessonInfos: LessonInfoRow[] = [];
  if (allLessonIds.length > 0) {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, lesson_number, title, topic_id, expected_completion_date")
      .in("id", allLessonIds);
    if (error) throw error;
    lessonInfos = (data ?? []) as LessonInfoRow[];
  }
  const lessonInfoById = new Map(lessonInfos.map((lesson) => [lesson.id, lesson]));

  const topicIds = [
    ...new Set(
      lessonInfos
        .map((lesson) => lesson.topic_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  let topics: { id: string; title: string }[] = [];
  if (topicIds.length > 0) {
    const { data, error } = await supabase
      .from("subject_topics")
      .select("id, title")
      .in("id", topicIds);
    if (error) throw error;
    topics = data ?? [];
  }
  const topicTitleById = new Map(topics.map((topic) => [topic.id, topic.title]));

  function resolveTopicTitleForLesson(lessonInfo: LessonInfoRow | undefined): string | null {
    if (!lessonInfo) return null;
    const topicTitle = lessonInfo.topic_id ? topicTitleById.get(lessonInfo.topic_id) : undefined;
    return resolveCurrentTopicTitle({ topicTitle, lessonTitle: lessonInfo.title });
  }

  let completions: CompletionRow[] = [];
  if (selectedLessonIds.length > 0) {
    const { data, error } = await supabase
      .from("learner_lesson_completions")
      .select("lesson_id, completed_at")
      .eq("learner_id", learnerId)
      .in("lesson_id", selectedLessonIds);
    if (error) throw error;
    completions = (data ?? []) as CompletionRow[];
  }
  const completedAtByLessonId = new Map(
    completions.map((completion) => [completion.lesson_id, completion.completed_at]),
  );

  let submissions: SubmissionRow[] = [];
  if (selectedActivityIds.length > 0) {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select(
        "activity_id, status, submitted_at, final_mark, original_total_marks, activity_snapshot",
      )
      .eq("learner_id", learnerId)
      .in("activity_id", selectedActivityIds);
    if (error) throw error;
    submissions = (data ?? []) as SubmissionRow[];
  }
  const submissionByActivityId = new Map(
    submissions.map((submission) => [submission.activity_id, submission]),
  );

  // The two approved historical exceptions (see lib/rewards/
  // legacyActivity5Window.ts / legacyActivity2Window.ts) -- their window
  // is anchored to the first genuine submission PLATFORM-WIDE, so this is
  // only ever queried when a selected activity is actually one of them.
  const legacyActivity5WindowEnd = selectedActivityIds.includes(LEGACY_ACTIVITY_5_ID)
    ? await findLegacyWindowEnd(supabase, LEGACY_ACTIVITY_5_ID, deriveLegacyActivity5Window)
    : null;
  const legacyActivity2WindowEnd = selectedActivityIds.includes(LEGACY_ACTIVITY_2_ID)
    ? await findLegacyWindowEnd(supabase, LEGACY_ACTIVITY_2_ID, deriveLegacyActivity2Window)
    : null;

  const lessons: MonthlyReportLessonEntry[] = selectedLessonIds.flatMap((lessonId) => {
    const lessonInfo = lessonInfoById.get(lessonId);
    if (!lessonInfo) return [];

    const completedAt = completedAtByLessonId.get(lessonId) ?? null;
    const isComplete = completedAt !== null;
    const isOverdue = !isComplete && isDateOverdue(lessonInfo.expected_completion_date, now);
    const status: MonthlyReportLessonEntry["status"] = isComplete
      ? isLessonCompletionLate(completedAt, lessonInfo.expected_completion_date)
        ? "Late"
        : "Complete"
      : isOverdue
        ? "Overdue"
        : "Incomplete";

    return [
      {
        lessonId,
        lessonNumber: lessonInfo.lesson_number,
        title: lessonInfo.title,
        topicTitle: resolveTopicTitleForLesson(lessonInfo),
        dueDate: lessonInfo.expected_completion_date,
        completedAt,
        status,
      },
    ];
  });

  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const reportActivities: MonthlyReportActivityEntry[] = selectedActivityIds.flatMap(
    (activityId) => {
      const activity = activityById.get(activityId);
      if (!activity) return [];
      // Defensive: never count a lesson-quiz-backed row as a real
      // activity even if one was somehow included in the selection.
      if (!activityBackedMaterialIds.has(activity.lesson_material_id)) return [];

      const lessonId = materialById.get(activity.lesson_material_id)?.lesson_id ?? null;
      if (!lessonId) return [];
      const lessonInfo = lessonInfoById.get(lessonId);

      const submission = submissionByActivityId.get(activityId) ?? null;
      const snapshot =
        submission && isActivitySubmissionSnapshot(submission.activity_snapshot)
          ? submission.activity_snapshot
          : null;

      const timing = resolveActivityTiming({
        activityId,
        isSubmitted: submission !== null,
        submittedAt: submission?.submitted_at ?? null,
        liveDueDate: activity.due_date,
        snapshotDueDate: snapshot?.activity.dueDate ?? null,
        legacyActivity5WindowEnd,
        legacyActivity2WindowEnd,
        now,
      });

      // Authoritative teacher-final mark ONLY -- Kingdom's preliminary
      // mark never enters this payload, matching the same gate already
      // enforced by the Coin engine and the returned-feedback reader.
      let hasAuthoritativeMark = false;
      let finalMark: number | null = null;
      let totalMarks: number | null = null;
      if (submission !== null && submission.status === "returned" && submission.final_mark !== null) {
        hasAuthoritativeMark = true;
        finalMark = submission.final_mark;
        // Frozen fallback chain, identical to the Coin engine and the
        // returned-feedback reader: original_total_marks first, then the
        // frozen submission snapshot's total, then the live activity
        // total only as a last resort.
        totalMarks =
          submission.original_total_marks ?? snapshot?.activity.totalMarks ?? activity.total_marks;
      }
      const percentage =
        hasAuthoritativeMark && finalMark !== null && totalMarks !== null && totalMarks > 0
          ? (finalMark / totalMarks) * 100
          : null;

      return [
        {
          activityId,
          lessonId,
          lessonNumber: lessonInfo?.lesson_number ?? "",
          title: snapshot?.activity.title ?? activity.title,
          topicTitle: resolveTopicTitleForLesson(lessonInfo),
          dueDate: timing.dueDate,
          dueDateBasis: timing.dueDateBasis,
          submissionStatus: submission ? submission.status : "not_submitted",
          submittedAt: submission?.submitted_at ?? null,
          isLate: timing.isLate,
          daysLate: timing.daysLate,
          isOverdue: timing.isOverdue,
          hasAuthoritativeMark,
          finalMark,
          totalMarks,
          percentage,
        },
      ];
    },
  );

  // Curriculum-sequence order (3.1 -> 3.2 -> ... -> 3.10), never
  // created/updated/due date or status/submission-state order. Applied
  // once here -- the single shared layer both the teacher's "browse
  // everything" catalog call and the final scoped preview call pass
  // through -- so neither the selection UI nor the generated report ever
  // needs its own sort. Purely a display-order change: every calculation
  // below is order-independent (sums, counts, filters), so this cannot
  // affect academic/engagement/evidence/badge results.
  const sortedLessons = sortLessonEntriesByCurriculumOrder(lessons);
  const sortedActivities = sortActivityEntriesByCurriculumOrder(reportActivities);

  const engagement = calculateEngagementSummary(sortedLessons, sortedActivities);
  const academicBase = calculateReportAcademicSummary(sortedActivities);
  const topicBreakdown = calculateTopicBreakdown(sortedActivities);
  const evidenceFlags = calculateEvidenceFlags({
    activities: sortedActivities,
    topicBreakdown,
    engagement,
  });
  const badge = calculateMonthlyReportBadge({
    // The badge consumes the NEW equal-weight report academic result, not
    // the old marks-weighted one -- results may be materially lower where
    // selected work is missing, which is the intended correction.
    academicPercentage: academicBase.academicPercentage,
    combinedCompletionRate: engagement.completionRate,
    combinedPunctualityRate: engagement.punctualityRate,
    // Evidence sufficiency deliberately still keys off genuinely RETURNED
    // activities (returnedActivityCount), never the effective denominator
    // (which can look artificially adequate purely because missing work
    // contributes zero) -- see calculateEvidenceFlags/
    // insufficientMarkedEvidence, unchanged from before this correction.
    sufficientEvidence: !evidenceFlags.insufficientMarkedEvidence,
  });

  return {
    schemaVersion: MONTHLY_REPORT_SCHEMA_VERSION,
    meta: {
      learnerId,
      learnerName: learnerProfile?.displayName ?? "Learner",
      subjectId,
      subjectName: subject?.displayName ?? "Subject",
      teacherId,
      teacherName,
      reportMonth,
      generatedAt: now.toISOString(),
    },
    lessons: sortedLessons,
    activities: sortedActivities,
    academic: { ...academicBase, topicBreakdown },
    engagement,
    evidenceFlags,
    badge,
    attendance: null,
  };
}
