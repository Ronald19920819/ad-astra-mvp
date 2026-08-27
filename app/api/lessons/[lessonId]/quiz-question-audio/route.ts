import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";
import { getLearnerAccessibilityEntitlement } from "@/lib/supabase/learnerAccessibility";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { getAccessibilityNarrationVoice } from "@/lib/accessibility/narrationVoice";
import { buildQuestionSpeechScript } from "@/lib/accessibility/questionSpeech";
import { getOrGenerateQuestionAudioUrl } from "@/lib/kingdom/questionAudioGeneration";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UNAVAILABLE_MESSAGE = "Question audio is unavailable. Please try again.";

// Stage C: "Listen to Question" for a lesson quiz question. Playback
// only -- never mutates a quiz answer, quiz score, lesson completion, XP,
// or Coins. Every gate is re-checked fresh on every request, exactly
// mirroring app/api/lessons/[lessonId]/accessibility-audio/route.ts:
//   1. genuine authenticated learner session;
//   2. enrolled subject access for this lesson;
//   3. accessibility_enabled entitlement (the Stage A canonical reader);
//   4. the requested question ID genuinely belongs to THIS lesson's quiz
//      (never trusted from the client beyond scoping the query) --
//      prevents an arbitrary question ID from another subject/lesson ever
//      being requested.
// correct_option is never selected here -- only the learner-facing
// question text, options, and marks.
export async function GET(
  request: Request,
  context: RouteContext<"/api/lessons/[lessonId]/quiz-question-audio">,
) {
  const { lessonId } = await context.params;
  const questionId = new URL(request.url).searchParams.get("questionId");

  if (!uuidPattern.test(lessonId) || !questionId || !uuidPattern.test(questionId)) {
    return Response.json(
      { error: "Valid quiz question audio details are required." },
      { status: 400 },
    );
  }

  try {
    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Learner sign-in is required." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: lesson, error: lessonError } = await admin
      .from("lessons")
      .select("id, subject_id, status")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (!lesson || lesson.status !== "published") {
      return Response.json({ error: "This lesson could not be found." }, { status: 404 });
    }

    const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
    if (!access.allowed) {
      return Response.json(
        { error: "Learner access to this subject is required." },
        { status: 403 },
      );
    }

    const entitlement = await getLearnerAccessibilityEntitlement({
      authUserId: user.id,
    });
    if (!entitlement.accessibilityEnabled) {
      return Response.json(
        { error: "Accessibility support is not enabled for this learner." },
        { status: 403 },
      );
    }

    const { data: quizMaterial, error: quizMaterialError } = await admin
      .from("lesson_materials")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("material_type", "quiz")
      .maybeSingle();

    if (quizMaterialError) throw quizMaterialError;
    if (!quizMaterial) {
      return Response.json({ error: "This lesson has no quiz." }, { status: 404 });
    }

    const { data: activity, error: activityError } = await admin
      .from("activities")
      .select("id")
      .eq("lesson_material_id", quizMaterial.id)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return Response.json({ error: "This lesson has no quiz." }, { status: 404 });
    }

    // The activity_id scope is what prevents an arbitrary questionId from
    // a different lesson/subject's quiz (or from a Business Studies
    // activity) from ever being served here.
    const { data: question, error: questionError } = await admin
      .from("activity_questions")
      .select("id, question_text, marks, option_a, option_b, option_c, option_d")
      .eq("id", questionId)
      .eq("activity_id", activity.id)
      .maybeSingle();

    if (questionError) throw questionError;
    if (!question) {
      return Response.json({ error: "This question could not be found." }, { status: 404 });
    }

    const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
    if (!subject) {
      return Response.json({ error: "This subject could not be resolved." }, { status: 500 });
    }

    const { language, voice } = getAccessibilityNarrationVoice(subject.familyKey);

    const script = buildQuestionSpeechScript({
      questionText: question.question_text,
      options: {
        A: question.option_a,
        B: question.option_b,
        C: question.option_c,
        D: question.option_d,
      },
      marks: question.marks,
      language,
    });

    const url = await getOrGenerateQuestionAudioUrl({
      admin,
      questionId: question.id,
      script,
      language,
      voice,
    });

    return Response.json({ ready: true, url });
  } catch (error) {
    console.error("Learner quiz question audio access failed:", {
      lessonId,
      questionId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
