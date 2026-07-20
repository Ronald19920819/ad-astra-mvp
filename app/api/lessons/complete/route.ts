import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

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
      attempt.quiz_score !== attempt.quiz_total ||
      attempt.completed_at
    ) {
      return NextResponse.json(
        { error: "A verified 10/10 quiz attempt is required." },
        { status: 403 },
      );
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
