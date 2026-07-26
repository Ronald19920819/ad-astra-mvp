import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { hasPassedLessonQuiz } from "@/lib/lessons/lessonAssessment";
import {
  buildBusinessStudiesLessonQuizMarkingPrompt,
  parseBusinessStudiesLessonQuizMarking,
} from "@/lib/kingdom/examiner/businessStudiesLessonQuiz";
import {
  parseReadingContent,
  readingContentToPlainText,
} from "@/lib/readings/structuredReading";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type SubmittedAnswer = {
  questionId: string;
  answer: string;
};

function isSubmittedAnswer(value: unknown): value is SubmittedAnswer {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.questionId === "string" &&
    answer.questionId.length > 0 &&
    typeof answer.answer === "string" &&
    answer.answer.trim().length > 0 &&
    answer.answer.length <= 4000
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
    if (user) {
      const access = await verifyLearnerSubjectAccess(
        user.id,
        lesson.subject_id,
      );
      if (!access.allowed) {
        return NextResponse.json(
          { error: "You are not enrolled in this subject." },
          { status: 403 },
        );
      }
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
        "id, question_text, answer_text, marks, assessment_objective, question_type, display_order",
      )
      .eq("activity_id", activity.id)
      .order("display_order", { ascending: true });

    if (questionsError) throw new Error(questionsError.message);

    const officialQuestionIds = new Set(
      (officialQuestions ?? []).map((question) => question.id),
    );

    if (
      officialQuestionIds.size === 0 ||
      submittedAnswers.length !== officialQuestionIds.size ||
      submittedAnswers.some(
        (answer) => !officialQuestionIds.has(answer.questionId),
      ) ||
      officialQuestions?.some(
        (question) =>
          !question.answer_text?.trim() ||
          !Number.isInteger(question.marks) ||
          question.marks <= 0,
      )
    ) {
      return NextResponse.json(
        { error: "The submitted questions do not match this lesson quiz." },
        { status: 400 },
      );
    }

    const { data: readingMaterial, error: readingError } = await supabase
      .from("lesson_materials")
      .select("content_text")
      .eq("lesson_id", lessonId)
      .eq("material_type", "reading")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (readingError) throw new Error(readingError.message);
    const parsedReading = parseReadingContent(
      readingMaterial?.content_text ?? null,
    );
    if (
      parsedReading.kind === "malformed" &&
      process.env.NODE_ENV === "development"
    ) {
      console.error("Lesson quiz reading could not be parsed:", { lessonId });
    }
    const lessonReading =
      readingContentToPlainText(readingMaterial?.content_text ?? null).trim() ||
      null;

    const learnerAnswers = new Map(
      submittedAnswers.map((answer) => [answer.questionId, answer.answer.trim()]),
    );
    const markingInput = officialQuestions.map((question) => ({
      questionId: question.id,
      questionText: question.question_text,
      learnerAnswer: learnerAnswers.get(question.id) ?? "",
      expectedAnswer: question.answer_text!,
      maximumMark: question.marks,
      assessmentObjective: question.assessment_objective,
      questionType: question.question_type,
    }));
    const subjectContext = buildKingdomSubjectContext({
      subjectKey: subject.key,
      role: "Examiner",
      taskType: "Mark lesson reading quiz",
    });
    const prompt = buildBusinessStudiesLessonQuizMarkingPrompt({
      subjectContext,
      lessonReading,
      questions: markingInput,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });
    const outputText = response.output_text?.trim();

    if (!outputText) {
      throw new Error("Kingdom returned an empty marking response.");
    }

    const results = parseBusinessStudiesLessonQuizMarking(
      outputText,
      markingInput,
    );
    const score = results.reduce((total, result) => total + result.mark, 0);
    const total = markingInput.reduce(
      (markTotal, question) => markTotal + question.maximumMark,
      0,
    );
    const passed = hasPassedLessonQuiz(score, total);
    let completionToken: string | null = null;
    if (user) {
      const { data: attempt, error: attemptError } = await supabase
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

      if (passed) {
        completionToken = attempt.id;
      }
    }

    return NextResponse.json({
      score,
      total,
      passed,
      results,
      completionToken,
      completionAvailable: Boolean(completionToken),
    });
  } catch (error) {
    console.error("Kingdom lesson quiz marking error:", error);

    return NextResponse.json(
      { error: "Kingdom could not mark this quiz. Please try again." },
      { status: 500 },
    );
  }
}
