import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import {
  hasPassedLessonQuiz,
  LESSON_QUIZ_PASS_PERCENT,
} from "@/lib/lessons/lessonAssessment";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const lessonId = body.lessonId;
    const completionToken = body.completionToken;

    if (
      typeof lessonId !== "string" ||
      !lessonId ||
      typeof completionToken !== "string" ||
      !completionToken
    ) {
      return NextResponse.json(
        { error: "Valid completion details are required." },
        { status: 400 },
      );
    }

    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
    } = await requestClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Learner sign-in is required to complete a lesson." },
        { status: 401 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, subject_id")
      .eq("id", lessonId)
      .eq("status", "published")
      .maybeSingle();

    if (lessonError) throw new Error(lessonError.message);
    if (!lesson) {
      return NextResponse.json(
        { error: "Published lesson not found." },
        { status: 404 },
      );
    }

    const subjectAccess = await verifyLearnerSubjectAccess(
      user.id,
      lesson.subject_id,
    );
    if (!subjectAccess.allowed) {
      return NextResponse.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("learner_quiz_attempts")
      .select("id, learner_id, lesson_id, quiz_score, quiz_total, passed, completed_at")
      .eq("id", completionToken)
      .eq("learner_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (attemptError) throw new Error(attemptError.message);
    if (
      !attempt ||
      !attempt.passed ||
      !hasPassedLessonQuiz(attempt.quiz_score, attempt.quiz_total) ||
      attempt.completed_at
    ) {
      return NextResponse.json(
        {
          error: `A verified quiz score of at least ${LESSON_QUIZ_PASS_PERCENT}% is required.`,
        },
        { status: 403 },
      );
    }

    const { data: videoMaterial, error: videoMaterialError } = await supabase
      .from("lesson_materials")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("material_type", "video")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (videoMaterialError) throw new Error(videoMaterialError.message);

    if (videoMaterial) {
      const { data: videoProgress, error: videoProgressError } = await supabase
        .from("learner_lesson_progress")
        .select("video_progress_percent")
        .eq("learner_profile_id", subjectAccess.learnerProfileId)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (videoProgressError) throw new Error(videoProgressError.message);
      if (Number(videoProgress?.video_progress_percent ?? 0) < 90) {
        return NextResponse.json(
          { error: "Watch at least 90% of the lesson video before completing the lesson." },
          { status: 403 },
        );
      }
    }

    const completedAt = new Date().toISOString();
    const { error: completionError } = await supabase
      .from("learner_lesson_completions")
      .upsert(
        {
          learner_id: user.id,
          lesson_id: lessonId,
          completed_at: completedAt,
          quiz_score: attempt.quiz_score,
        },
        { onConflict: "learner_id,lesson_id", ignoreDuplicates: true },
      );

    if (completionError) throw new Error(completionError.message);

    const { error: updateAttemptError } = await supabase
      .from("learner_quiz_attempts")
      .update({ completed_at: completedAt })
      .eq("id", attempt.id)
      .is("completed_at", null);

    if (updateAttemptError) throw new Error(updateAttemptError.message);

    return NextResponse.json({ completed: true, completedAt });
  } catch (error) {
    console.error("Lesson completion error:", error);

    return NextResponse.json(
      { error: "The lesson could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
