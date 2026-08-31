import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { calculateTeacherReviewScore } from "@/lib/activities/teacherReviewScoring";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { isActivitySubmissionSnapshot } from "@/lib/activities/activitySnapshot";
import { evaluateAndRecordPairReward } from "@/lib/supabase/coinRewardTrigger";
import { sendReviewReturnedEmailIfDue } from "@/lib/email/reviewReturnEmail";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmittedAnswer = {
  answerId: string;
  teacherMark: number;
  teacherFeedback: string;
};

function isSubmittedAnswer(value: unknown): value is SubmittedAnswer {
  if (!value || typeof value !== "object") return false;

  const review = value as Record<string, unknown>;
  return (
    typeof review.answerId === "string" &&
    uuidPattern.test(review.answerId) &&
    typeof review.teacherMark === "number" &&
    Number.isInteger(review.teacherMark) &&
    typeof review.teacherFeedback === "string" &&
    review.teacherFeedback.length <= 5000
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;

  if (!uuidPattern.test(submissionId)) {
    return NextResponse.json(
      { error: "A valid submission ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON request body.", code: "MALFORMED_JSON" },
      { status: 400 },
    );
  }

  try {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid review data.", code: "INVALID_REVIEW" },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const submittedAnswers = payload.answers;
    const teacherComment = payload.teacherComment;
    const subjectId = payload.subjectId;

    if (
      !Array.isArray(submittedAnswers) ||
      submittedAnswers.length === 0 ||
      submittedAnswers.length > 100 ||
      !submittedAnswers.every(isSubmittedAnswer) ||
      typeof teacherComment !== "string" ||
      teacherComment.length > 10000 ||
      typeof subjectId !== "string" ||
      !getSubjectConfigurationByDatabaseId(subjectId)
    ) {
      return NextResponse.json(
        { error: "Invalid review data.", code: "INVALID_REVIEW" },
        { status: 400 },
      );
    }

    const submittedAnswerIds = submittedAnswers.map(
      (answer) => answer.answerId,
    );

    if (new Set(submittedAnswerIds).size !== submittedAnswerIds.length) {
      return NextResponse.json(
        { error: "Duplicate answer IDs are not allowed.", code: "INVALID_REVIEW" },
        { status: 400 },
      );
    }

    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const { admin: supabase, profileId } = authorization.teacher;

    const { data: submission, error: submissionError } = await supabase
      .from("activity_submissions")
      .select("id, learner_id, activity_id, status, activity_snapshot, original_total_marks")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) throw submissionError;
    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Captured BEFORE the update below -- the sole signal for whether this
    // is a genuine first-time transition into "returned" (email-eligible)
    // versus editing an already-returned review (never email-eligible,
    // even if the mark/comment/reviewed_at change). Never derived from
    // reviewed_at, which this same route overwrites on every save.
    const isFirstReturn = submission.status !== "returned";

    const snapshot = isActivitySubmissionSnapshot(
      submission.activity_snapshot,
    )
      ? submission.activity_snapshot
      : null;

    if (snapshot && snapshot.subject.id !== subjectId) {
      return NextResponse.json(
        { error: "Submission not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, lesson_material_id")
      .eq("id", submission.activity_id)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return NextResponse.json(
        { error: "Submission not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (!snapshot) {
      const { data: material, error: materialError } = await supabase
        .from("lesson_materials")
        .select("lesson_id")
        .eq("id", activity.lesson_material_id)
        .maybeSingle();

      if (materialError) throw materialError;
      if (!material) {
        return NextResponse.json(
          { error: "Submission not found.", code: "NOT_FOUND" },
          { status: 404 },
        );
      }

      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id")
        .eq("id", material.lesson_id)
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .maybeSingle();

      if (lessonError) throw lessonError;
      if (!lesson) {
        return NextResponse.json(
          { error: "Submission not found.", code: "NOT_FOUND" },
          { status: 404 },
        );
      }
    }

    const { data: answerRows, error: answersError } = await supabase
      .from("activity_submission_answers")
      .select(`
        id,
        submission_id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        kingdom_judgement,
        teacher_mark,
        teacher_feedback,
        created_at,
        updated_at
      `)
      .eq("submission_id", submissionId);

    if (answersError) throw answersError;

    const answers = answerRows ?? [];
    const answerById = new Map(answers.map((answer) => [answer.id, answer]));

    if (
      answers.length === 0 ||
      submittedAnswers.length !== answers.length ||
      submittedAnswers.some((answer) => !answerById.has(answer.answerId))
    ) {
      return NextResponse.json(
        { error: "Every submitted answer must be reviewed.", code: "INCOMPLETE_REVIEW" },
        { status: 422 },
      );
    }

    const questionIds = answers.map((answer) => answer.question_id);
    let maximumMarks: Map<string, number>;

    if (snapshot) {
      maximumMarks = new Map(
        snapshot.questions.map((question) => [question.id, question.marks]),
      );
    } else {
      const { data: questions, error: questionsError } = await supabase
        .from("activity_questions")
        .select("id, marks")
        .eq("activity_id", activity.id)
        .in("id", questionIds);

      if (questionsError) throw questionsError;
      maximumMarks = new Map(
        (questions ?? []).map((question) => [question.id, question.marks]),
      );
    }
    const submittedAnswerById = new Map(
      submittedAnswers.map((answer) => [answer.answerId, answer]),
    );

    if (maximumMarks.size !== answers.length) {
      return NextResponse.json(
        { error: "Submission questions do not match this activity.", code: "INVALID_REVIEW" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const scoreSummary = calculateTeacherReviewScore(
      answers.map((answer) => {
        const submittedAnswer = submittedAnswerById.get(answer.id)!;
        const maximumMark = maximumMarks.get(answer.question_id);

        if (maximumMark === undefined) {
          throw new RangeError("Submission questions do not match this activity.");
        }

        return {
          maximumMarks: maximumMark,
          teacherMark: submittedAnswer.teacherMark,
        };
      }),
    );

    const updatedAnswers = answers.map((answer) => {
      const submittedAnswer = submittedAnswerById.get(answer.id)!;

      return {
        ...answer,
        teacher_mark: submittedAnswer.teacherMark,
        teacher_feedback: submittedAnswer.teacherFeedback.trim() || null,
        updated_at: now,
      };
    });

    const originalTotalMarks =
      submission.original_total_marks ??
      (snapshot
        ? snapshot.activity.totalMarks
        : [...maximumMarks.values()].reduce(
            (total, marks) => total + marks,
            0,
          ));

    if (scoreSummary.earnedMarks > originalTotalMarks) {
      throw new RangeError("The final mark exceeds the submitted total.");
    }

    const { error: answerUpdateError } = await supabase
      .from("activity_submission_answers")
      .upsert(updatedAnswers, { onConflict: "id" });

    if (answerUpdateError) throw answerUpdateError;

    const { error: submissionUpdateError } = await supabase
      .from("activity_submissions")
      .update({
        status: "returned",
        final_mark: scoreSummary.earnedMarks,
        teacher_comment: teacherComment.trim() || null,
        reviewed_at: now,
        reviewed_by: profileId,
        updated_at: now,
      })
      .eq("id", submissionId);

    if (submissionUpdateError) {
      const rollbackAnswers = answers.map((answer) => ({
        ...answer,
        updated_at: new Date().toISOString(),
      }));
      const { error: rollbackError } = await supabase
        .from("activity_submission_answers")
        .upsert(rollbackAnswers, { onConflict: "id" });

      if (rollbackError) {
        console.error("Teacher review answer rollback failed:", {
          submissionId,
          message: rollbackError.message,
          code: rollbackError.code,
        });
      }

      throw submissionUpdateError;
    }

    // The teacher-final mark is now authoritative -- this is the one
    // moment a linked pair can become Coin-eligible (see
    // lib/supabase/coinRewardTrigger.ts's header comment for why nothing
    // was ever wired to this before). A reward-evaluation failure must
    // never fail the review itself, which has already succeeded and been
    // persisted -- log and continue.
    let rewardOutcome: { awarded: boolean; amount?: number; reason?: string } = {
      awarded: false,
    };
    try {
      const result = await evaluateAndRecordPairReward(
        submission.learner_id,
        submissionId,
      );
      rewardOutcome = result.awarded
        ? { awarded: true, amount: result.amount }
        : { awarded: false, reason: result.reason };
    } catch (rewardError) {
      console.error("Coin reward evaluation failed after teacher review:", {
        submissionId,
        message: rewardError instanceof Error ? rewardError.message : "Unknown error",
      });
    }

    // Only a genuine first-time return is email-eligible -- editing an
    // already-returned review (isFirstReturn === false) must never
    // re-notify the learner, no matter what changed. An email-provider
    // failure must never undo or fail the review itself, which has
    // already succeeded and been persisted -- log and continue, exactly
    // like the Coin reward side effect above.
    if (isFirstReturn) {
      try {
        await sendReviewReturnedEmailIfDue(submission.learner_id, submissionId);
      } catch (emailError) {
        console.error("Review-return email failed after teacher review:", {
          submissionId,
          message: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      finalMark: scoreSummary.earnedMarks,
      finalPercentage: scoreSummary.percentage,
      rewardOutcome,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: error.message, code: "INVALID_MARK" },
        { status: 422 },
      );
    }

    console.error("Unable to return subject submission:", {
      submissionId,
      error,
    });
    return NextResponse.json(
      { error: "The reviewed submission could not be returned.", code: "RETURN_FAILED" },
      { status: 500 },
    );
  }
}