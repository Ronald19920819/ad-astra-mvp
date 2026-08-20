import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { hasPassedLessonQuiz } from "@/lib/lessons/lessonAssessment";
import { evaluateAndPersistLessonCompletion } from "@/lib/lessons/lessonCompletionService";
import {
  isLessonQuizOptionLetter,
  scoreLessonQuizAnswers,
  type LessonQuizOptionLetter,
  type StoredLessonQuizQuestion,
} from "@/lib/lessons/lessonQuiz";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

type SubmittedAnswer = {
  questionId: string;
  answer: LessonQuizOptionLetter;
};

function isSubmittedAnswer(value: unknown): value is SubmittedAnswer {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.questionId === "string" &&
    answer.questionId.length > 0 &&
    isLessonQuizOptionLetter(answer.answer)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const lessonId = body.lessonId;
    const submittedAnswers = body.answers;

    if (
      typeof lessonId !== "string" ||
      !lessonId.trim() ||
      !Array.isArray(submittedAnswers) ||
      submittedAnswers.length === 0 ||
      submittedAnswers.length > 50 ||
      !submittedAnswers.every(isSubmittedAnswer)
    ) {
      return NextResponse.json(
        { error: "A valid lesson and answer for every question are required." },
        { status: 400 },
      );
    }

    const submittedQuestionIds = submittedAnswers.map(
      (answer) => answer.questionId,
    );

    if (new Set(submittedQuestionIds).size !== submittedQuestionIds.length) {
      return NextResponse.json(
        { error: "Duplicate question IDs are not allowed." },
        { status: 400 },
      );
    }

    const requestClient = await createSupabaseRequestClient();
    const {
      data: { user },
    } = await requestClient.auth.getUser();
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
    const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
    if (!subject) {
      return NextResponse.json(
        { error: "The lesson subject is not supported." },
        { status: 422 },
      );
    }
    let learnerProfileId: string | null = null;
    if (user) {
      const access = await verifyLearnerSubjectAccess(user.id, lesson.subject_id);
      if (!access.allowed) {
        return NextResponse.json(
          { error: "You are not enrolled in this subject." },
          { status: 403 },
        );
      }
      learnerProfileId = access.learnerProfileId;
    }

    if (user) {
      const { data: passedAttempt, error: passedAttemptError } = await supabase
        .from("learner_quiz_attempts")
        .select("id, quiz_score, quiz_total, created_at, completed_at")
        .eq("learner_id", user.id)
        .eq("lesson_id", lessonId)
        .eq("passed", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (passedAttemptError) throw new Error(passedAttemptError.message);
      if (passedAttempt) {
        return NextResponse.json(
          {
            error: "This lesson quiz has already been passed.",
            savedResult: passedAttempt,
          },
          { status: 409 },
        );
      }
    }

    const { data: quizMaterial, error: materialError } = await supabase
      .from("lesson_materials")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("material_type", "quiz")
      .maybeSingle();

    if (materialError) throw new Error(materialError.message);
    if (!quizMaterial) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id")
      .eq("lesson_material_id", quizMaterial.id)
      .maybeSingle();

    if (activityError) throw new Error(activityError.message);
    if (!activity) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    const { data: officialQuestions, error: questionsError } = await supabase
      .from("activity_questions")
      .select(
        "id, question_text, marks, display_order, option_a, option_b, option_c, option_d, correct_option",
      )
      .eq("activity_id", activity.id)
      .order("display_order", { ascending: true });

    if (questionsError) throw new Error(questionsError.message);

    const normalizedQuestions: StoredLessonQuizQuestion[] = (officialQuestions ?? [])
      .flatMap((question) => {
        if (
          !question.question_text?.trim() ||
          !Number.isInteger(question.marks) ||
          question.marks <= 0 ||
          typeof question.option_a !== "string" ||
          !question.option_a.trim() ||
          typeof question.option_b !== "string" ||
          !question.option_b.trim() ||
          typeof question.option_c !== "string" ||
          !question.option_c.trim() ||
          typeof question.option_d !== "string" ||
          !question.option_d.trim() ||
          !isLessonQuizOptionLetter(question.correct_option)
        ) {
          return [];
        }

        return [
          {
            id: question.id,
            questionText: question.question_text,
            marks: question.marks,
            optionA: question.option_a.trim(),
            optionB: question.option_b.trim(),
            optionC: question.option_c.trim(),
            optionD: question.option_d.trim(),
            correctOption: question.correct_option,
          },
        ];
      });

    const officialQuestionIds = new Set(normalizedQuestions.map((question) => question.id));

    if (
      officialQuestionIds.size === 0 ||
      submittedAnswers.length !== officialQuestionIds.size ||
      submittedAnswers.some((answer) => !officialQuestionIds.has(answer.questionId))
    ) {
      return NextResponse.json(
        { error: "The submitted questions do not match this lesson quiz." },
        { status: 400 },
      );
    }

    const { results, score, total } = scoreLessonQuizAnswers(
      normalizedQuestions,
      submittedAnswers,
    );
    const passed = hasPassedLessonQuiz(score, total);
    let lessonCompletion: Awaited<
      ReturnType<typeof evaluateAndPersistLessonCompletion>
    > | null = null;

    if (user) {
      const { error: attemptError } = await supabase
        .from("learner_quiz_attempts")
        .insert({
          learner_id: user.id,
          lesson_id: lessonId,
          quiz_score: score,
          quiz_total: total,
          passed,
        })
        .select("id")
        .single();

      if (attemptError) throw new Error(attemptError.message);

      // A passed quiz can be the final requirement a lesson needed --
      // reevaluate and auto-persist completion immediately, no separate
      // learner action required.
      if (passed && learnerProfileId) {
        lessonCompletion = await evaluateAndPersistLessonCompletion({
          authUserId: user.id,
          learnerProfileId,
          lessonId,
        });
      }
    }

    return NextResponse.json({
      score,
      total,
      passed,
      results,
      lessonCompletion,
    });
  } catch (error) {
    console.error("Lesson quiz marking error:", error);

    return NextResponse.json(
      { error: "This quiz could not be marked. Please try again." },
      { status: 500 },
    );
  }
}
