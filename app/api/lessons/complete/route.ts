import { NextResponse } from "next/server";
import { evaluateAndPersistLessonCompletion } from "@/lib/lessons/lessonCompletionService";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

// Phase 2: lesson completion is now automatic and adaptive -- the learner
// no longer presses a separate "Complete Lesson" button, and this route no
// longer gates completion behind a single quiz-attempt completionToken
// (which made quiz-less lessons impossible to complete at all). It is kept
// as a thin, reusable manual-reconciliation endpoint: given a lessonId, it
// runs the same canonical evaluator every other trigger point uses
// (lib/lessons/lessonCompletionService.ts) and returns the current
// completion state. Useful as an explicit fallback if a learner's client
// ever needs to force a fresh evaluation.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const lessonId = body.lessonId;

    if (typeof lessonId !== "string" || !lessonId) {
      return NextResponse.json(
        { error: "A valid lesson is required." },
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

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    const lessonCompletion = await evaluateAndPersistLessonCompletion({
      authUserId: user.id,
      learnerProfileId: access.learnerProfileId,
      lessonId,
    });

    return NextResponse.json({
      completed: lessonCompletion.isComplete,
      completedAt: lessonCompletion.completedAt,
      lessonCompletion,
    });
  } catch (error) {
    console.error("Lesson completion evaluation error:", error);

    return NextResponse.json(
      { error: "The lesson could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
