import { NextResponse } from "next/server";
import {
  markBusinessStudiesActivity,
  type ActivityMarkingQuestion,
} from "@/lib/kingdom/examiner/businessStudiesActivity";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmittedAnswer = {
  questionId: string;
  answerText: string;
};

type OfficialActivityQuestion = {
  id: string;
  question_text: string;
  marks: number;
  assessment_objective: string | null;
  guidance: string | null;
  question_type: string | null;
  answer_text: string | null;
};

function isSubmittedAnswer(value: unknown): value is SubmittedAnswer {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.questionId === "string" &&
    uuidPattern.test(answer.questionId) &&
    typeof answer.answerText === "string" &&
    answer.answerText.length <= 10000
  );
}

type LearnerIdentityResult =
  | { learnerId: string }
  | { error: string; code: string; status: number };

async function getLearnerIdentity(): Promise<LearnerIdentityResult> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (user) return { learnerId: user.id };

  if (process.env.NODE_ENV !== "development") {
    return {
      error: "Learner sign-in required",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  const testLearnerId = process.env.TEST_LEARNER_ID?.trim();

  if (!testLearnerId) {
    return {
      error: "Development test learner is not configured.",
      code: "TEST_LEARNER_NOT_CONFIGURED",
      status: 500,
    };
  }

  if (!uuidPattern.test(testLearnerId)) {
    return {
      error: "The configured development test learner is invalid.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: authUserData, error: authUserError } =
    await supabase.auth.admin.getUserById(testLearnerId);

  if (authUserError || !authUserData.user) {
    return {
      error: "The configured development test learner does not exist.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", testLearnerId)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return {
      error: "The configured development test learner has no learner profile.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) {
    return {
      error:
        "The configured development test learner has no active learner profile.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  return { learnerId: testLearnerId };
}

async function loadSavedSubmission(
  learnerId: string,
  activityId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      status,
      submitted_at,
      preliminary_mark,
      preliminary_total,
      preliminary_percentage,
      kingdom_marked_at,
      final_mark,
      reviewed_at,
      activity_submission_answers (
        id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        kingdom_judgement,
        teacher_mark,
        teacher_feedback
      )
    `)
    .eq("learner_id", learnerId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markSubmissionAsFailed(submissionId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("activity_submissions")
    .update({
      status: "marking_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    console.error("Unable to record activity marking failure:", {
      submissionId,
      message: error.message,
      code: error.code,
    });
  }
}

export async function GET(request: Request) {
  const identity = await getLearnerIdentity();

  if (!("learnerId" in identity)) {
    return NextResponse.json(
      { error: identity.error, code: identity.code },
      { status: identity.status },
    );
  }

  const { learnerId } = identity;

  const activityId = new URL(request.url).searchParams.get("activityId");

  if (!activityId || !uuidPattern.test(activityId)) {
    return NextResponse.json(
      { error: "Invalid activity ID", code: "INVALID_SUBMISSION" },
      { status: 400 },
    );
  }

  try {
    const submission = await loadSavedSubmission(learnerId, activityId);
    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Unable to load learner activity submission:", {
      activityId,
      learnerId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to load this submission", code: "LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let submissionId: string | null = null;
  let learnerId: string | null = null;
  let activityIdForLog: string | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const activityId = body.activityId;
    const submittedAnswers = body.answers;
    activityIdForLog = typeof activityId === "string" ? activityId : null;

    if (
      typeof activityId !== "string" ||
      !uuidPattern.test(activityId) ||
      !Array.isArray(submittedAnswers) ||
      submittedAnswers.length === 0 ||
      submittedAnswers.length > 100 ||
      !submittedAnswers.every(isSubmittedAnswer)
    ) {
      return NextResponse.json(
        { error: "Invalid submission data", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    const questionIds = submittedAnswers.map((answer) => answer.questionId);

    if (new Set(questionIds).size !== questionIds.length) {
      return NextResponse.json(
        { error: "Duplicate question IDs are not allowed", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    if (submittedAnswers.some((answer) => !answer.answerText.trim())) {
      return NextResponse.json(
        { error: "Please answer every question before submitting", code: "BLANK_ANSWERS" },
        { status: 422 },
      );
    }

    const identity = await getLearnerIdentity();

    if (!("learnerId" in identity)) {
      return NextResponse.json(
        { error: identity.error, code: identity.code },
        { status: identity.status },
      );
    }

    learnerId = identity.learnerId;

    const supabase = createSupabaseAdminClient();
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, title, lesson_material_id")
      .eq("id", activityId)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: material, error: materialError } = await supabase
      .from("lesson_materials")
      .select("id, lesson_id, material_type, content_text")
      .eq("id", activity.lesson_material_id)
      .maybeSingle();

    if (materialError) throw materialError;
    if (
      !material ||
      material.material_type !== "reading" ||
      !material.content_text?.trim()
    ) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, subject_id, status")
      .eq("id", material.lesson_id)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (
      !lesson ||
      lesson.status !== "published" ||
      lesson.subject_id !== businessStudiesSubjectId
    ) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from("activity_questions")
      .select(`
        id,
        question_text,
        marks,
        assessment_objective,
        guidance,
        question_type,
        answer_text,
        display_order,
        question_number
      `)
      .eq("activity_id", activityId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("question_number", { ascending: true });

    if (questionsError) throw questionsError;

    const officialQuestions = (questionsData ?? []) as OfficialActivityQuestion[];
    const officialQuestionIds = new Set(
      officialQuestions.map((question) => question.id),
    );

    if (officialQuestions.length === 0) {
      return NextResponse.json(
        { error: "This activity has no questions", code: "NO_QUESTIONS" },
        { status: 422 },
      );
    }

    if (
      officialQuestions.some(
        (question) =>
          !Number.isInteger(question.marks) || question.marks <= 0,
      )
    ) {
      return NextResponse.json(
        {
          error: "This activity has invalid question marks",
          code: "INVALID_ACTIVITY",
        },
        { status: 422 },
      );
    }

    if (
      submittedAnswers.length !== officialQuestions.length ||
      submittedAnswers.some(
        (answer) => !officialQuestionIds.has(answer.questionId),
      )
    ) {
      return NextResponse.json(
        { error: "Invalid submission data", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    const { data: existingSubmission, error: existingError } = await supabase
      .from("activity_submissions")
      .select("id")
      .eq("learner_id", learnerId)
      .eq("activity_id", activityId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingSubmission) {
      return NextResponse.json(
        { error: "This activity has already been submitted", code: "ALREADY_SUBMITTED" },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: submission, error: submissionError } = await supabase
      .from("activity_submissions")
      .insert({
        activity_id: activityId,
        learner_id: learnerId,
        status: "submitted",
        submitted_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (submissionError) {
      if (submissionError.code === "23505") {
        return NextResponse.json(
          { error: "This activity has already been submitted", code: "ALREADY_SUBMITTED" },
          { status: 409 },
        );
      }
      throw submissionError;
    }

    submissionId = submission.id;
    const answerRows = submittedAnswers.map((answer) => ({
      submission_id: submission.id,
      question_id: answer.questionId,
      answer_text: answer.answerText.trim(),
      updated_at: now,
    }));
    const { data: savedAnswers, error: answersError } = await supabase
      .from("activity_submission_answers")
      .insert(answerRows)
      .select("id, submission_id, question_id, answer_text");

    if (answersError) {
      const { error: cleanupError } = await supabase
        .from("activity_submissions")
        .delete()
        .eq("id", submission.id);

      if (cleanupError) {
        console.error("Incomplete activity submission cleanup failed:", {
          submissionId: submission.id,
          message: cleanupError.message,
          code: cleanupError.code,
        });
      }
      throw answersError;
    }

    const learnerAnswers = new Map(
      savedAnswers.map((answer) => [answer.question_id, answer.answer_text]),
    );
    const markingQuestions: ActivityMarkingQuestion[] = officialQuestions.map(
      (question) => ({
        questionId: question.id,
        questionText: question.question_text,
        maximumMark: question.marks,
        assessmentObjective: question.assessment_objective,
        guidance: question.guidance,
        questionType: question.question_type,
        expectedAnswer: question.answer_text,
        learnerAnswer: learnerAnswers.get(question.id) ?? "",
      }),
    );

    let markingResult;

    try {
      markingResult = await markBusinessStudiesActivity({
        activityTitle: activity.title,
        lessonTitle: lesson.title,
        lessonReading: material.content_text,
        questions: markingQuestions,
      });
    } catch (error) {
      console.error("Kingdom activity preliminary marking failed:", {
        activityId,
        submissionId: submission.id,
        error,
      });
      await markSubmissionAsFailed(submission.id);
      const savedSubmission = await loadSavedSubmission(learnerId, activityId);

      return NextResponse.json(
        {
          error:
            "Your activity was saved, but preliminary marking could not be completed.",
          code: "MARKING_FAILED",
          saved: true,
          submission: savedSubmission,
        },
        { status: 502 },
      );
    }

    const resultByQuestionId = new Map(
      markingResult.results.map((result) => [result.questionId, result]),
    );
    const markedAnswerRows = savedAnswers.map((answer) => {
      const result = resultByQuestionId.get(answer.question_id);

      if (!result) {
        throw new Error("A marked answer result is missing.");
      }

      return {
        id: answer.id,
        submission_id: answer.submission_id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        kingdom_mark: result.awardedMark,
        kingdom_feedback: result.feedback,
        kingdom_judgement: result.judgement,
        updated_at: new Date().toISOString(),
      };
    });
    const { error: markingSaveError } = await supabase
      .from("activity_submission_answers")
      .upsert(markedAnswerRows, { onConflict: "submission_id,question_id" });

    if (markingSaveError) throw markingSaveError;

    const markedAt = new Date().toISOString();
    const { error: submissionUpdateError } = await supabase
      .from("activity_submissions")
      .update({
        status: "awaiting_review",
        preliminary_mark: markingResult.preliminaryMark,
        preliminary_total: markingResult.totalMarks,
        preliminary_percentage: markingResult.percentage,
        kingdom_marked_at: markedAt,
        updated_at: markedAt,
      })
      .eq("id", submission.id);

    if (submissionUpdateError) throw submissionUpdateError;

    const savedSubmission = await loadSavedSubmission(learnerId, activityId);
    return NextResponse.json({ submission: savedSubmission });
  } catch (error) {
    if (submissionId) await markSubmissionAsFailed(submissionId);

    console.error("Unable to submit and mark Business Studies activity:", {
      activityId: activityIdForLog,
      learnerId,
      submissionId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to submit the activity", code: "SUBMISSION_FAILED" },
      { status: 500 },
    );
  }
}
