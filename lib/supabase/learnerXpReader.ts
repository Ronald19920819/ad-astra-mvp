import "server-only";

import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";
import {
  isLearnerActivitySubmittedStatus,
  type LearnerActivitySubmissionStatus,
} from "@/lib/activities/learnerActivityStatus";
import {
  calculateXpTotal,
  evaluateCoinGateStatus,
  type CoinGateStatus,
} from "@/lib/rewards/xpRules";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// THE canonical, server-side XP calculation for AD Astra (Stage 1). Every
// future consumer (learner header, learner profile, Coin Gate, admin
// dashboard, XP history) must call getLearnerXpSummary rather than
// re-deriving XP independently -- this is the one place lesson/activity
// completion counts are turned into an XP total.
//
// Architecture decision (Stage 1): XP is DERIVED live from the existing
// canonical completion/submission tables on every call, not stored in a
// separate ledger/balance table. This is deliberate, not an oversight:
//   - learner_lesson_completions has a real DB `unique (learner_id,
//     lesson_id)` constraint (supabase/migrations/202607190001_secure_lesson_completion.sql)
//   - activity_submissions has a real DB `unique (learner_id, activity_id)`
//     constraint (supabase/migrations/202607200001_activity_assessment_cycle.sql)
// Both already make "did this learner genuinely complete this lesson/
// activity" a fact that can occur at most once at the source, for free --
// so a live COUNT is exact, requires no new schema, and can never drift
// from the tables it's derived from. A ledger becomes necessary once
// Coins introduce something that ISN'T already a single canonical
// completion event (bonuses, deductions, redemptions) -- that's a later
// stage's problem, not this one's.
export type LearnerXpSubjectContribution = {
  subjectId: string;
  lessonsCompleted: number;
  activitiesCompleted: number;
  xp: number;
};

export type LearnerXpSummary = {
  learnerAuthUserId: string;
  totalLessonsCompleted: number;
  totalActivitiesCompleted: number;
  totalXp: number;
  // Audit-only status per lib/rewards/xpRules.ts -- Coins are not awarded
  // or implemented by this reader.
  coinGateStatus: CoinGateStatus;
  bySubject: LearnerXpSubjectContribution[];
};

type LessonRow = { id: string; subject_id: string; status: string };
type MaterialRow = { id: string; lesson_id: string; material_type: string };
type ActivityRow = { id: string; lesson_material_id: string };
type CompletionRow = { learner_id: string; lesson_id: string };
type SubmissionRow = {
  learner_id: string;
  activity_id: string;
  status: LearnerActivitySubmissionStatus;
};

type SubjectLinkageContext = {
  // lessonId -> subjectId, published lessons only.
  publishedLessonSubjectById: Map<string, string>;
  // activityId -> subjectId, for genuine activity-backed activities linked
  // to a published lesson only (excludes lesson-quiz-internal "activities"
  // rows and anything linked to unpublished/removed content).
  activitySubjectById: Map<string, string>;
};

async function loadSubjectLinkageContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<SubjectLinkageContext> {
  const [lessonsResult, materialsResult, activitiesResult] = await Promise.all([
    supabase.from("lessons").select("id, subject_id, status"),
    supabase.from("lesson_materials").select("id, lesson_id, material_type"),
    supabase.from("activities").select("id, lesson_material_id"),
  ]);

  if (lessonsResult.error) throw lessonsResult.error;
  if (materialsResult.error) throw materialsResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const lessons = (lessonsResult.data ?? []) as LessonRow[];
  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const activities = (activitiesResult.data ?? []) as ActivityRow[];

  const publishedLessonSubjectById = new Map(
    lessons
      .filter((lesson) => lesson.status === "published")
      .map((lesson) => [lesson.id, lesson.subject_id]),
  );

  const materialById = new Map(materials.map((material) => [material.id, material]));
  // Only reading/activity-type materials can back a genuine learner
  // activity -- excludes quiz-linked "activities" rows, matching the same
  // predicate every other reader in this codebase uses
  // (lib/activities/activityBackedMaterial.ts). This is the one and only
  // place this reader decides what counts as a "genuine" activity.
  const activityBackedMaterialIds = new Set(filterActivityBackedMaterialIds(materials));

  const activitySubjectById = new Map<string, string>();
  for (const activity of activities) {
    if (!activityBackedMaterialIds.has(activity.lesson_material_id)) continue;
    const material = materialById.get(activity.lesson_material_id);
    if (!material) continue;
    const subjectId = publishedLessonSubjectById.get(material.lesson_id);
    if (!subjectId) continue; // lesson unpublished, removed, or missing
    activitySubjectById.set(activity.id, subjectId);
  }

  return { publishedLessonSubjectById, activitySubjectById };
}

function summariseLearnerXp(
  learnerAuthUserId: string,
  completions: readonly CompletionRow[],
  submissions: readonly SubmissionRow[],
  context: SubjectLinkageContext,
): LearnerXpSummary {
  // Defensive second layer beyond the DB unique constraints cited above --
  // never counts the same lesson/activity twice for this learner even if
  // fed a row set that somehow contained a duplicate.
  const countedLessonIds = new Set<string>();
  const bySubjectLessons = new Map<string, number>();
  for (const completion of completions) {
    const subjectId = context.publishedLessonSubjectById.get(completion.lesson_id);
    if (!subjectId) continue; // completion for an unpublished/removed lesson
    if (countedLessonIds.has(completion.lesson_id)) continue;
    countedLessonIds.add(completion.lesson_id);
    bySubjectLessons.set(subjectId, (bySubjectLessons.get(subjectId) ?? 0) + 1);
  }

  const countedActivityIds = new Set<string>();
  const bySubjectActivities = new Map<string, number>();
  for (const submission of submissions) {
    if (!isLearnerActivitySubmittedStatus(submission.status)) continue;
    const subjectId = context.activitySubjectById.get(submission.activity_id);
    if (!subjectId) continue; // quiz-linked, unpublished, or missing
    if (countedActivityIds.has(submission.activity_id)) continue;
    countedActivityIds.add(submission.activity_id);
    bySubjectActivities.set(subjectId, (bySubjectActivities.get(subjectId) ?? 0) + 1);
  }

  const subjectIds = new Set([...bySubjectLessons.keys(), ...bySubjectActivities.keys()]);
  const bySubject: LearnerXpSubjectContribution[] = [...subjectIds].map((subjectId) => {
    const lessonsCompleted = bySubjectLessons.get(subjectId) ?? 0;
    const activitiesCompleted = bySubjectActivities.get(subjectId) ?? 0;
    return {
      subjectId,
      lessonsCompleted,
      activitiesCompleted,
      xp: calculateXpTotal(lessonsCompleted, activitiesCompleted),
    };
  });

  const totalLessonsCompleted = countedLessonIds.size;
  const totalActivitiesCompleted = countedActivityIds.size;
  const totalXp = calculateXpTotal(totalLessonsCompleted, totalActivitiesCompleted);

  return {
    learnerAuthUserId,
    totalLessonsCompleted,
    totalActivitiesCompleted,
    totalXp,
    coinGateStatus: evaluateCoinGateStatus(
      totalXp,
      totalLessonsCompleted,
      totalActivitiesCompleted,
    ),
    bySubject,
  };
}

// Single-learner entry point -- the one future consumers (header, profile,
// Coin Gate) should call. Scoped queries only fetch this learner's own
// completion/submission rows.
export async function getLearnerXpSummary(
  learnerAuthUserId: string,
): Promise<LearnerXpSummary> {
  const supabase = createSupabaseAdminClient();
  const context = await loadSubjectLinkageContext(supabase);

  const [completionsResult, submissionsResult] = await Promise.all([
    supabase
      .from("learner_lesson_completions")
      .select("learner_id, lesson_id")
      .eq("learner_id", learnerAuthUserId),
    supabase
      .from("activity_submissions")
      .select("learner_id, activity_id, status")
      .eq("learner_id", learnerAuthUserId),
  ]);

  if (completionsResult.error) throw completionsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;

  return summariseLearnerXp(
    learnerAuthUserId,
    (completionsResult.data ?? []) as CompletionRow[],
    (submissionsResult.data ?? []) as SubmissionRow[],
    context,
  );
}

// Platform-wide entry point for audit/admin use -- computes every learner
// with at least one genuine completion/submission in a single batch,
// using the exact same summariseLearnerXp logic as the single-learner path
// above (no separate calculation).
export async function getAllLearnerXpSummaries(): Promise<LearnerXpSummary[]> {
  const supabase = createSupabaseAdminClient();
  const context = await loadSubjectLinkageContext(supabase);

  const [completionsResult, submissionsResult] = await Promise.all([
    supabase.from("learner_lesson_completions").select("learner_id, lesson_id"),
    supabase.from("activity_submissions").select("learner_id, activity_id, status"),
  ]);

  if (completionsResult.error) throw completionsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;

  const completions = (completionsResult.data ?? []) as CompletionRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];

  const learnerIds = new Set<string>([
    ...completions.map((completion) => completion.learner_id),
    ...submissions.map((submission) => submission.learner_id),
  ]);

  return [...learnerIds].map((learnerAuthUserId) =>
    summariseLearnerXp(
      learnerAuthUserId,
      completions.filter((completion) => completion.learner_id === learnerAuthUserId),
      submissions.filter((submission) => submission.learner_id === learnerAuthUserId),
      context,
    ),
  );
}
