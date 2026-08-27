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
import {
  isActivitySubmissionSnapshot,
  snapshotQuestionById,
} from "@/lib/activities/activitySnapshot";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UNAVAILABLE_MESSAGE = "Question audio is unavailable. Please try again.";

type QuestionAudioSource = {
  questionText: string;
  marks: number;
  options: { A: string | null; B: string | null; C: string | null; D: string | null } | null;
  subjectId: string;
};

// Stage C: "Listen to Question" for an activity question. Playback only
// -- never mutates an answer, autosave, submission, or marking state.
//
// A submitted activity is served from its FROZEN activity_snapshot: this
// is the exact text the learner was actually asked, which may since have
// been edited on the live row -- see AD ASTRA ACCESSIBILITY STAGE C
// section 10's explicit preference that a learner reviewing their own
// submitted work can still listen to the ORIGINAL question. Ownership of
// the submission (learner_id === the authenticated learner) is itself
// sufficient proof of legitimate access here, matching the existing
// precedent in
// app/api/activity-submissions/[submissionId]/reading-pdf/route.ts.
//
// An activity with no submission yet is served from the live row, gated
// by the same subject-enrolment check the live activity workspace itself
// uses (verifyLearnerSubjectAccess).
async function resolveQuestionAudioSource(args: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  authUserId: string;
  activityId: string;
  questionId: string;
}): Promise<
  | { ok: true; source: QuestionAudioSource }
  | { ok: false; status: number; error: string }
> {
  const { admin, authUserId, activityId, questionId } = args;

  const { data: activity, error: activityError } = await admin
    .from("activities")
    .select("id, lesson_material_id")
    .eq("id", activityId)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activity) {
    return { ok: false, status: 404, error: "This activity could not be found." };
  }

  const { data: submission, error: submissionError } = await admin
    .from("activity_submissions")
    .select("id, learner_id, activity_snapshot")
    .eq("activity_id", activityId)
    .eq("learner_id", authUserId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submissionError) throw submissionError;

  const snapshot =
    submission && isActivitySubmissionSnapshot(submission.activity_snapshot)
      ? submission.activity_snapshot
      : null;

  if (snapshot) {
    const question = snapshotQuestionById(snapshot).get(questionId);
    if (!question) {
      return { ok: false, status: 404, error: "This question could not be found." };
    }

    return {
      ok: true,
      source: {
        questionText: question.questionText,
        marks: question.marks,
        // The frozen submission snapshot never carries MCQ option fields
        // -- no historical activity question has ever used them (only
        // lesson quiz questions do, served by a separate route). If a
        // future activity question type gains selectable options, the
        // snapshot schema would need to be extended to carry them; out of
        // scope here since no such data exists today.
        options: null,
        subjectId: snapshot.subject.id,
      },
    };
  }

  const { data: material, error: materialError } = await admin
    .from("lesson_materials")
    .select("id, lessons!inner(id, subject_id, status)")
    .eq("id", activity.lesson_material_id)
    .maybeSingle();

  if (materialError) throw materialError;

  const lesson = material
    ? Array.isArray(material.lessons)
      ? material.lessons[0]
      : material.lessons
    : null;

  if (!lesson || lesson.status !== "published") {
    return { ok: false, status: 404, error: "This activity could not be found." };
  }

  const access = await verifyLearnerSubjectAccess(authUserId, lesson.subject_id);
  if (!access.allowed) {
    return {
      ok: false,
      status: 403,
      error: "Learner access to this subject is required.",
    };
  }

  const { data: question, error: questionError } = await admin
    .from("activity_questions")
    .select("id, question_text, marks, option_a, option_b, option_c, option_d")
    .eq("id", questionId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (questionError) throw questionError;
  if (!question) {
    return { ok: false, status: 404, error: "This question could not be found." };
  }

  return {
    ok: true,
    source: {
      questionText: question.question_text,
      marks: question.marks,
      options: {
        A: question.option_a,
        B: question.option_b,
        C: question.option_c,
        D: question.option_d,
      },
      subjectId: lesson.subject_id,
    },
  };
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/activities/[activityId]/question-audio">,
) {
  const { activityId } = await context.params;
  const questionId = new URL(request.url).searchParams.get("questionId");

  if (!uuidPattern.test(activityId) || !questionId || !uuidPattern.test(questionId)) {
    return Response.json(
      { error: "Valid question audio details are required." },
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

    const entitlement = await getLearnerAccessibilityEntitlement({
      authUserId: user.id,
    });
    if (!entitlement.accessibilityEnabled) {
      return Response.json(
        { error: "Accessibility support is not enabled for this learner." },
        { status: 403 },
      );
    }

    const resolved = await resolveQuestionAudioSource({
      admin,
      authUserId: user.id,
      activityId,
      questionId,
    });

    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status });
    }

    const subject = getSubjectConfigurationByDatabaseId(resolved.source.subjectId);
    if (!subject) {
      return Response.json({ error: "This subject could not be resolved." }, { status: 500 });
    }

    const { language, voice } = getAccessibilityNarrationVoice(subject.familyKey);

    const script = buildQuestionSpeechScript({
      questionText: resolved.source.questionText,
      options: resolved.source.options,
      marks: resolved.source.marks,
      language,
    });

    const url = await getOrGenerateQuestionAudioUrl({
      admin,
      questionId,
      script,
      language,
      voice,
    });

    return Response.json({ ready: true, url });
  } catch (error) {
    console.error("Learner activity question audio access failed:", {
      activityId,
      questionId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
