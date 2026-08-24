import "server-only";

import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";
import {
  isLearnerActivitySubmittedStatus,
  type LearnerActivitySubmissionStatus,
} from "@/lib/activities/learnerActivityStatus";
import {
  calculatePairCoins,
  type PairCoinCalculationResult,
} from "@/lib/rewards/coinRules";
import {
  calculateXpTotal,
  evaluateCoinGateStatus,
  type CoinGateStatus,
} from "@/lib/rewards/xpRules";
import {
  LEGACY_ACTIVITY_5_ID,
  calculateLegacyActivity5Lateness,
  deriveLegacyActivity5Window,
  isLegacyActivity5,
} from "@/lib/rewards/legacyActivity5Window";
import {
  LEGACY_ACTIVITY_2_ID,
  calculateLegacyActivity2Lateness,
  deriveLegacyActivity2Window,
  isLegacyActivity2,
} from "@/lib/rewards/legacyActivity2Window";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// THE Coin earning engine (Stage 3): reconstructs, per learner, exactly
// when the three-condition Coin Gate unlocked (reusing
// evaluateCoinGateStatus from lib/rewards/xpRules.ts unchanged) and which
// linked lesson+activity pairs completed AFTER that moment qualify for
// Coins (via lib/rewards/coinRules.ts, unchanged).
//
// This module is READ-ONLY -- it never calls
// lib/supabase/coinLedger.ts::recordLessonActivityPairReward. It exists so
// Stage 3 can PREVIEW what a historical backfill would produce without
// writing anything, per the explicit "do not execute yet" instruction. A
// later, explicitly-authorised script is expected to iterate this same
// preview's qualifying pairs and call recordLessonActivityPairReward for
// each one.

type LessonRow = {
  id: string;
  subject_id: string;
  status: string;
  lesson_number: string;
  title: string;
};
type MaterialRow = { id: string; lesson_id: string; material_type: string };
type ActivityRow = {
  id: string;
  lesson_material_id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
};
type CompletionRow = { learner_id: string; lesson_id: string; completed_at: string };
type SubmissionRow = {
  id: string;
  learner_id: string;
  activity_id: string;
  status: LearnerActivitySubmissionStatus;
  submitted_at: string;
  final_mark: number | null;
  original_total_marks: number | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

type ActivityLink = {
  lessonId: string;
  lessonTitle: string;
  lessonNumber: string;
  subjectId: string;
  activityTitle: string;
  liveDueDate: string | null;
  liveTotalMarks: number;
};

export type CoinPairIneligibleReason =
  | "pre_gate"
  | "gate_never_unlocked"
  | "awaiting_teacher_final_mark"
  | "no_authoritative_due_date";

export type CoinPairPreview = {
  learnerAuthUserId: string;
  subjectId: string;
  lessonId: string;
  lessonTitle: string;
  lessonNumber: string;
  activityId: string;
  activityTitle: string;
  // The activity_submissions.id this pair is derived from -- the stable
  // source identity a write path needs to call
  // coinLedger.ts::recordLessonActivityPairReward, and the same identity
  // the DB-level idempotency index (coin_transactions_pair_reward_
  // idempotency_idx) is keyed on.
  activitySubmissionId: string;
  dueDate: string | null;
  // "frozen_snapshot": activity_snapshot.activity.dueDate, captured at the
  // moment of submission -- preferred, since a due date edited after
  // submission must not retroactively change historical lateness, the
  // same principle already locked in for the mark denominator.
  // "live_activity": no snapshot exists (legacy submission) -- fell back
  // to the current activities.due_date.
  dueDateSource: "frozen_snapshot" | "live_activity" | null;
  // "normal": the pair's due date is a real stored date (frozen snapshot or
  // live activity). The other two values identify exactly ONE of the two
  // approved historical exceptions (lib/rewards/legacyActivity5Window.ts,
  // lib/rewards/legacyActivity2Window.ts) -- each activity never had a due
  // date, so lateness is derived from its own 24-hour window instead.
  // Surfaced so a future Coin statement can explain itself, and so the two
  // exceptions stay independently auditable rather than collapsing into one
  // generic "legacy" label.
  dueDateBasis:
    | "normal"
    | "legacy_24h_window_activity_5"
    | "legacy_24h_window_activity_2";
  // Only meaningful when dueDateBasis is one of the legacy values; null
  // otherwise.
  insideLegacyWindow: boolean | null;
  lessonCompletedAt: string;
  activitySubmittedAt: string;
  pairCompletionTimestamp: string;
  hasTeacherFinalMark: boolean;
  finalMark: number | null;
  frozenTotalMarks: number | null;
  percentage: number | null;
  daysLate: number | null;
  isPostGate: boolean;
  ineligibleReason: CoinPairIneligibleReason | null;
  coinResult: PairCoinCalculationResult | null;
};

export type CoinGateCrossing = {
  timestamp: string;
  eventType: "lesson" | "activity";
  subjectId: string;
  lessonTitle: string;
  activityTitle: string | null;
  xpBefore: number;
  xpAfter: number;
  lessonsBefore: number;
  lessonsAfter: number;
  activitiesBefore: number;
  activitiesAfter: number;
};

export type LearnerCoinPreview = {
  learnerAuthUserId: string;
  totalLessonsCompleted: number;
  totalActivitiesCompleted: number;
  totalXp: number;
  coinGateStatus: CoinGateStatus;
  gateCrossing: CoinGateCrossing | null;
  pairs: CoinPairPreview[];
  totalHypotheticalCoins: number;
};

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function daysBetweenDateKeys(laterKey: string, earlierKey: string) {
  const later = new Date(`${laterKey}T00:00:00Z`).getTime();
  const earlier = new Date(`${earlierKey}T00:00:00Z`).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

// The legacy window is anchored to the FIRST GENUINE submission to Activity
// 5 platform-wide (see lib/rewards/legacyActivity5Window.ts) -- not per
// learner. Returns null only if nobody has genuinely submitted to it yet.
function findLegacyActivity5WindowEnd(
  submissions: readonly {
    activity_id: string;
    status: LearnerActivitySubmissionStatus;
    submitted_at: string;
  }[],
): string | null {
  const firstGenuineSubmission = submissions
    .filter(
      (submission) =>
        submission.activity_id === LEGACY_ACTIVITY_5_ID &&
        isLearnerActivitySubmittedStatus(submission.status),
    )
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0];

  if (!firstGenuineSubmission) return null;
  return deriveLegacyActivity5Window(firstGenuineSubmission.submitted_at).windowEnd;
}

// Same derivation as findLegacyActivity5WindowEnd above, independently
// anchored to Activity 2's own first genuine submission (see lib/rewards/
// legacyActivity2Window.ts). Kept as a separate function, not a
// parameterised one, so each of the two approved exceptions stays a
// distinct, greppable code path -- there is no generic "any missing-date
// activity" mechanism here.
function findLegacyActivity2WindowEnd(
  submissions: readonly {
    activity_id: string;
    status: LearnerActivitySubmissionStatus;
    submitted_at: string;
  }[],
): string | null {
  const firstGenuineSubmission = submissions
    .filter(
      (submission) =>
        submission.activity_id === LEGACY_ACTIVITY_2_ID &&
        isLearnerActivitySubmittedStatus(submission.status),
    )
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0];

  if (!firstGenuineSubmission) return null;
  return deriveLegacyActivity2Window(firstGenuineSubmission.submitted_at).windowEnd;
}

async function loadCoinEngineContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const [lessonsResult, materialsResult, activitiesResult] = await Promise.all([
    supabase.from("lessons").select("id, subject_id, status, lesson_number, title"),
    supabase.from("lesson_materials").select("id, lesson_id, material_type"),
    supabase
      .from("activities")
      .select("id, lesson_material_id, title, total_marks, due_date"),
  ]);

  if (lessonsResult.error) throw lessonsResult.error;
  if (materialsResult.error) throw materialsResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const lessons = (lessonsResult.data ?? []) as LessonRow[];
  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const activities = (activitiesResult.data ?? []) as ActivityRow[];

  const publishedLessonById = new Map(
    lessons.filter((lesson) => lesson.status === "published").map((lesson) => [lesson.id, lesson]),
  );
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const activityBackedMaterialIds = new Set(filterActivityBackedMaterialIds(materials));

  const activityLinkById = new Map<string, ActivityLink>();
  for (const activity of activities) {
    if (!activityBackedMaterialIds.has(activity.lesson_material_id)) continue;
    const material = materialById.get(activity.lesson_material_id);
    if (!material) continue;
    const lesson = publishedLessonById.get(material.lesson_id);
    if (!lesson) continue;

    activityLinkById.set(activity.id, {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonNumber: lesson.lesson_number,
      subjectId: lesson.subject_id,
      activityTitle: activity.title,
      liveDueDate: activity.due_date,
      liveTotalMarks: activity.total_marks,
    });
  }

  return { publishedLessonById, activityLinkById };
}

type ChronologicalEvent = {
  type: "lesson" | "activity";
  timestamp: string;
  subjectId: string;
  lessonId: string;
  lessonTitle: string;
  activityId?: string;
  activityTitle?: string;
};

function buildLearnerCoinPreview(
  learnerAuthUserId: string,
  completions: readonly CompletionRow[],
  submissions: readonly SubmissionRow[],
  publishedLessonById: Map<string, LessonRow>,
  activityLinkById: Map<string, ActivityLink>,
  legacyActivity5WindowEnd: string | null,
  legacyActivity2WindowEnd: string | null,
): LearnerCoinPreview {
  const events: ChronologicalEvent[] = [];

  for (const completion of completions) {
    // Matches Stage 1's exclusion rule exactly: a completion row for an
    // unpublished/removed lesson contributes nothing.
    const lesson = publishedLessonById.get(completion.lesson_id);
    if (!lesson) continue;

    events.push({
      type: "lesson",
      timestamp: completion.completed_at,
      subjectId: lesson.subject_id,
      lessonId: completion.lesson_id,
      lessonTitle: lesson.title,
    });
  }
  for (const submission of submissions) {
    if (!isLearnerActivitySubmittedStatus(submission.status)) continue;
    const link = activityLinkById.get(submission.activity_id);
    if (!link) continue; // quiz-linked / unpublished -- excluded, matches Stage 1 XP rule
    events.push({
      type: "activity",
      timestamp: submission.submitted_at,
      subjectId: link.subjectId,
      lessonId: link.lessonId,
      lessonTitle: link.lessonTitle,
      activityId: submission.activity_id,
      activityTitle: link.activityTitle,
    });
  }
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let cumulativeXp = 0;
  let cumulativeLessons = 0;
  let cumulativeActivities = 0;
  let gateCrossing: CoinGateCrossing | null = null;

  for (const event of events) {
    const xpBefore = cumulativeXp;
    const lessonsBefore = cumulativeLessons;
    const activitiesBefore = cumulativeActivities;

    if (event.type === "lesson") cumulativeLessons += 1;
    else cumulativeActivities += 1;
    cumulativeXp = calculateXpTotal(cumulativeLessons, cumulativeActivities);

    if (
      !gateCrossing &&
      evaluateCoinGateStatus(cumulativeXp, cumulativeLessons, cumulativeActivities) === "unlocked"
    ) {
      gateCrossing = {
        timestamp: event.timestamp,
        eventType: event.type,
        subjectId: event.subjectId,
        lessonTitle: event.lessonTitle,
        activityTitle: event.activityTitle ?? null,
        xpBefore,
        xpAfter: cumulativeXp,
        lessonsBefore,
        lessonsAfter: cumulativeLessons,
        activitiesBefore,
        activitiesAfter: cumulativeActivities,
      };
    }
  }

  const totalXp = cumulativeXp;
  const totalLessonsCompleted = cumulativeLessons;
  const totalActivitiesCompleted = cumulativeActivities;
  const coinGateStatus = evaluateCoinGateStatus(
    totalXp,
    totalLessonsCompleted,
    totalActivitiesCompleted,
  );

  const lessonCompletionByLessonId = new Map(
    completions.map((completion) => [completion.lesson_id, completion.completed_at]),
  );

  const pairs: CoinPairPreview[] = [];
  for (const submission of submissions) {
    if (!isLearnerActivitySubmittedStatus(submission.status)) continue;
    const link = activityLinkById.get(submission.activity_id);
    if (!link) continue;
    const lessonCompletedAt = lessonCompletionByLessonId.get(link.lessonId);
    if (!lessonCompletedAt) continue; // lesson not (yet) completed -- no pair yet

    const pairCompletionTimestamp =
      new Date(submission.submitted_at).getTime() > new Date(lessonCompletedAt).getTime()
        ? submission.submitted_at
        : lessonCompletedAt;

    const isPostGate =
      gateCrossing !== null &&
      new Date(pairCompletionTimestamp).getTime() > new Date(gateCrossing.timestamp).getTime();

    const snapshot = isActivitySubmissionSnapshot(submission.activity_snapshot)
      ? submission.activity_snapshot
      : null;

    // Frozen submission mark basis (locked requirement): never the
    // live/current activities.total_marks if a frozen value exists.
    const frozenTotalMarks =
      submission.original_total_marks ?? snapshot?.activity.totalMarks ?? link.liveTotalMarks;

    const isLegacyActivity5Pair = isLegacyActivity5(submission.activity_id);
    const isLegacyActivity2Pair = isLegacyActivity2(submission.activity_id);

    // The two approved historical exceptions (lib/rewards/
    // legacyActivity5Window.ts, lib/rewards/legacyActivity2Window.ts):
    // neither activity ever had a due date, so their lateness is each
    // derived from their OWN 24-hour window instead of a stored date. Every
    // other rule (Coin Gate, teacher-final mark, >=50%, >4-days-late) still
    // applies unchanged -- each exception fixes ONLY its activity's missing
    // due-date problem. isLegacyActivity5Pair and isLegacyActivity2Pair can
    // never both be true (they're distinct hardcoded IDs), so there's no
    // ambiguity about which window governs a given pair.
    const dueDate =
      isLegacyActivity5Pair || isLegacyActivity2Pair
        ? null
        : (snapshot?.activity.dueDate ?? link.liveDueDate);
    const dueDateSource: CoinPairPreview["dueDateSource"] =
      isLegacyActivity5Pair || isLegacyActivity2Pair
        ? null
        : snapshot?.activity.dueDate
          ? "frozen_snapshot"
          : link.liveDueDate
            ? "live_activity"
            : null;
    const dueDateBasis: CoinPairPreview["dueDateBasis"] = isLegacyActivity5Pair
      ? "legacy_24h_window_activity_5"
      : isLegacyActivity2Pair
        ? "legacy_24h_window_activity_2"
        : "normal";

    const hasTeacherFinalMark = submission.status === "returned" && submission.final_mark !== null;

    let ineligibleReason: CoinPairIneligibleReason | null = null;
    let percentage: number | null = null;
    let daysLate: number | null = null;
    let coinResult: PairCoinCalculationResult | null = null;
    let insideLegacyWindow: boolean | null = null;

    if (!isPostGate) {
      ineligibleReason = gateCrossing ? "pre_gate" : "gate_never_unlocked";
    } else if (!hasTeacherFinalMark) {
      ineligibleReason = "awaiting_teacher_final_mark";
    } else if (isLegacyActivity5Pair) {
      if (!legacyActivity5WindowEnd) {
        // No genuine submission to this activity exists anywhere on the
        // platform to anchor a window from -- cannot evaluate yet.
        ineligibleReason = "no_authoritative_due_date";
      } else {
        percentage =
          frozenTotalMarks > 0
            ? ((submission.final_mark as number) / frozenTotalMarks) * 100
            : null;
        const lateness = calculateLegacyActivity5Lateness(
          pairCompletionTimestamp,
          legacyActivity5WindowEnd,
        );
        insideLegacyWindow = lateness.insideWindow;
        daysLate = lateness.daysLate;
        if (percentage !== null) {
          coinResult = calculatePairCoins({ percentage, daysLate });
        }
      }
    } else if (isLegacyActivity2Pair) {
      if (!legacyActivity2WindowEnd) {
        ineligibleReason = "no_authoritative_due_date";
      } else {
        percentage =
          frozenTotalMarks > 0
            ? ((submission.final_mark as number) / frozenTotalMarks) * 100
            : null;
        const lateness = calculateLegacyActivity2Lateness(
          pairCompletionTimestamp,
          legacyActivity2WindowEnd,
        );
        insideLegacyWindow = lateness.insideWindow;
        daysLate = lateness.daysLate;
        if (percentage !== null) {
          coinResult = calculatePairCoins({ percentage, daysLate });
        }
      }
    } else if (!dueDate) {
      ineligibleReason = "no_authoritative_due_date";
    } else {
      percentage =
        frozenTotalMarks > 0 ? ((submission.final_mark as number) / frozenTotalMarks) * 100 : null;
      daysLate = Math.max(
        0,
        daysBetweenDateKeys(dateKey(pairCompletionTimestamp), dateKey(dueDate)),
      );
      if (percentage !== null) {
        coinResult = calculatePairCoins({ percentage, daysLate });
      }
    }

    pairs.push({
      learnerAuthUserId,
      subjectId: link.subjectId,
      lessonId: link.lessonId,
      lessonTitle: link.lessonTitle,
      lessonNumber: link.lessonNumber,
      activityId: submission.activity_id,
      activityTitle: link.activityTitle,
      activitySubmissionId: submission.id,
      dueDate: dueDate ? dateKey(dueDate) : null,
      dueDateSource,
      dueDateBasis,
      insideLegacyWindow,
      lessonCompletedAt,
      activitySubmittedAt: submission.submitted_at,
      pairCompletionTimestamp,
      hasTeacherFinalMark,
      finalMark: submission.final_mark,
      frozenTotalMarks,
      percentage: percentage === null ? null : Math.round(percentage * 10) / 10,
      daysLate,
      isPostGate,
      ineligibleReason,
      coinResult,
    });
  }

  const totalHypotheticalCoins = pairs.reduce(
    (sum, pair) => sum + (pair.coinResult?.finalCoins ?? 0),
    0,
  );

  return {
    learnerAuthUserId,
    totalLessonsCompleted,
    totalActivitiesCompleted,
    totalXp,
    coinGateStatus,
    gateCrossing,
    pairs,
    totalHypotheticalCoins,
  };
}

// Platform-wide, read-only preview -- used for the Stage 3 audit report.
// Never calls lib/supabase/coinLedger.ts.
export async function previewAllLearnersCoinHistory(): Promise<LearnerCoinPreview[]> {
  const supabase = createSupabaseAdminClient();
  const { publishedLessonById, activityLinkById } = await loadCoinEngineContext(supabase);

  const [completionsResult, submissionsResult] = await Promise.all([
    supabase.from("learner_lesson_completions").select("learner_id, lesson_id, completed_at"),
    supabase
      .from("activity_submissions")
      .select(
        "id, learner_id, activity_id, status, submitted_at, final_mark, original_total_marks, activity_snapshot",
      ),
  ]);

  if (completionsResult.error) throw completionsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;

  const completions = (completionsResult.data ?? []) as CompletionRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const legacyActivity5WindowEnd = findLegacyActivity5WindowEnd(submissions);
  const legacyActivity2WindowEnd = findLegacyActivity2WindowEnd(submissions);

  const learnerIds = new Set<string>([
    ...completions.map((completion) => completion.learner_id),
    ...submissions.map((submission) => submission.learner_id),
  ]);

  return [...learnerIds].map((learnerAuthUserId) =>
    buildLearnerCoinPreview(
      learnerAuthUserId,
      completions.filter((completion) => completion.learner_id === learnerAuthUserId),
      submissions.filter((submission) => submission.learner_id === learnerAuthUserId),
      publishedLessonById,
      activityLinkById,
      legacyActivity5WindowEnd,
      legacyActivity2WindowEnd,
    ),
  );
}

// Single-learner variant, for a future per-learner preview/statement use
// case (mirrors getLearnerXpSummary's single-vs-all shape from Stage 1).
export async function previewLearnerCoinHistory(
  learnerAuthUserId: string,
): Promise<LearnerCoinPreview> {
  const supabase = createSupabaseAdminClient();
  const { publishedLessonById, activityLinkById } = await loadCoinEngineContext(supabase);

  const [
    completionsResult,
    submissionsResult,
    legacyActivity5SubmissionsResult,
    legacyActivity2SubmissionsResult,
  ] = await Promise.all([
    supabase
      .from("learner_lesson_completions")
      .select("learner_id, lesson_id, completed_at")
      .eq("learner_id", learnerAuthUserId),
    supabase
      .from("activity_submissions")
      .select(
        "id, learner_id, activity_id, status, submitted_at, final_mark, original_total_marks, activity_snapshot",
      )
      .eq("learner_id", learnerAuthUserId),
    // Each legacy window is anchored to that activity's first genuine
    // submission PLATFORM-WIDE, not just this learner's own -- fetched
    // unscoped so a single-learner preview stays consistent with the
    // all-learners one.
    supabase
      .from("activity_submissions")
      .select("learner_id, activity_id, status, submitted_at")
      .eq("activity_id", LEGACY_ACTIVITY_5_ID),
    supabase
      .from("activity_submissions")
      .select("learner_id, activity_id, status, submitted_at")
      .eq("activity_id", LEGACY_ACTIVITY_2_ID),
  ]);

  if (completionsResult.error) throw completionsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;
  if (legacyActivity5SubmissionsResult.error) throw legacyActivity5SubmissionsResult.error;
  if (legacyActivity2SubmissionsResult.error) throw legacyActivity2SubmissionsResult.error;

  const legacyActivity5WindowEnd = findLegacyActivity5WindowEnd(
    legacyActivity5SubmissionsResult.data ?? [],
  );
  const legacyActivity2WindowEnd = findLegacyActivity2WindowEnd(
    legacyActivity2SubmissionsResult.data ?? [],
  );

  return buildLearnerCoinPreview(
    learnerAuthUserId,
    (completionsResult.data ?? []) as CompletionRow[],
    (submissionsResult.data ?? []) as SubmissionRow[],
    publishedLessonById,
    activityLinkById,
    legacyActivity5WindowEnd,
    legacyActivity2WindowEnd,
  );
}
