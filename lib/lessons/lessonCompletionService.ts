import "server-only";

import {
  evaluateAdaptiveLessonCompletion,
  isVideoProgressComplete,
  type AdaptiveLessonCompletionResult,
} from "@/lib/lessons/adaptiveLessonCompletion";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Canonical server-side write path for lesson completion. Every event that
// could satisfy a requirement (reading marked complete, video progress
// update, quiz pass) -- and every lesson-view page load, for self-healing
// reconciliation of learners who already satisfied every requirement before
// this evaluator existed -- calls this same function. It never invents a
// second definition of "complete": all the actual decision logic lives in
// evaluateAdaptiveLessonCompletion.
export type LessonCompletionState = AdaptiveLessonCompletionResult & {
  completedAt: string | null;
  quizScore: number | null;
};

export async function evaluateAndPersistLessonCompletion({
  authUserId,
  learnerProfileId,
  lessonId,
}: {
  authUserId: string;
  learnerProfileId: string;
  lessonId: string;
}): Promise<LessonCompletionState> {
  const admin = createSupabaseAdminClient();

  const [materialsResult, progressResult, attemptResult, existingCompletionResult] =
    await Promise.all([
      admin.from("lesson_materials").select("material_type").eq("lesson_id", lessonId),
      admin
        .from("learner_lesson_progress")
        .select("video_progress_percent, reading_completed_at")
        .eq("learner_profile_id", learnerProfileId)
        .eq("lesson_id", lessonId)
        .maybeSingle(),
      admin
        .from("learner_quiz_attempts")
        .select("id, quiz_score, quiz_total")
        .eq("learner_id", authUserId)
        .eq("lesson_id", lessonId)
        .eq("passed", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("learner_lesson_completions")
        .select("completed_at, quiz_score")
        .eq("learner_id", authUserId)
        .eq("lesson_id", lessonId)
        .maybeSingle(),
    ]);

  if (materialsResult.error) throw materialsResult.error;
  if (progressResult.error) throw progressResult.error;
  if (attemptResult.error) throw attemptResult.error;
  if (existingCompletionResult.error) throw existingCompletionResult.error;

  const materialTypes = new Set(
    (materialsResult.data ?? []).map((material) => material.material_type),
  );
  const availability = {
    hasReading: materialTypes.has("reading"),
    hasVideo: materialTypes.has("video"),
    hasQuiz: materialTypes.has("quiz"),
  };

  const passedAttempt = attemptResult.data;
  const signals = {
    isReadingComplete: Boolean(progressResult.data?.reading_completed_at),
    isVideoComplete: isVideoProgressComplete(
      Number(progressResult.data?.video_progress_percent ?? 0),
    ),
    isQuizPassed: Boolean(passedAttempt),
  };

  const result = evaluateAdaptiveLessonCompletion(availability, signals);
  const existingCompletion = existingCompletionResult.data;
  let completedAt = existingCompletion?.completed_at ?? null;

  if (result.isComplete && !existingCompletion) {
    const nowIso = new Date().toISOString();

    // ignoreDuplicates makes this safe under concurrent triggers (e.g. a
    // video-progress ping and a quiz-mark request landing at the same
    // moment): whichever write reaches Postgres first wins, the other is a
    // silent no-op rather than an error, and completed_at is never
    // overwritten once set.
    const { error: upsertError } = await admin
      .from("learner_lesson_completions")
      .upsert(
        {
          learner_id: authUserId,
          lesson_id: lessonId,
          completed_at: nowIso,
          quiz_score: passedAttempt?.quiz_score ?? null,
        },
        { onConflict: "learner_id,lesson_id", ignoreDuplicates: true },
      );

    if (upsertError) throw upsertError;
    completedAt = nowIso;
  }

  return {
    ...result,
    completedAt,
    quizScore: existingCompletion?.quiz_score ?? passedAttempt?.quiz_score ?? null,
  };
}
