import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildLessonQuizPrompt } from "@/lib/kingdom/author/business-studies/cambridge/lessonQuizPrompt";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import {
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";
import { isCompleteLessonQuizQuestion } from "@/lib/lessons/lessonQuiz";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GeneratedLessonQuizQuestion = {
  questionId?: string;
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
};

type NormalizedLessonQuizQuestion = {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: 1;
};

function normalizeGeneratedCorrectOption(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeGeneratedQuestions(
  generatedQuestions: GeneratedLessonQuizQuestion[],
): NormalizedLessonQuizQuestion[] {
  return generatedQuestions.map((question, index) => ({
    id: index + 1,
    questionText: question.questionText?.trim() || "",
    optionA: question.optionA?.trim() || "",
    optionB: question.optionB?.trim() || "",
    optionC: question.optionC?.trim() || "",
    optionD: question.optionD?.trim() || "",
    correctOption: normalizeGeneratedCorrectOption(question.correctOption),
    marks: 1 as const,
  }));
}

function hasSingleRepeatedCorrectOption(
  questions: NormalizedLessonQuizQuestion[],
) {
  const distinctCorrectOptions = new Set(
    questions.map((question) => question.correctOption),
  );
  return distinctCorrectOptions.size === 1;
}

async function requestLessonQuiz(prompt: string) {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("Kingdom returned an empty response.");
  }

  const cleanedOutput = outputText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  if (process.env.NODE_ENV === "development") {
    console.info("Kingdom lesson quiz raw payload:", cleanedOutput);
  }

  const generatedQuiz = JSON.parse(cleanedOutput) as {
    questions?: GeneratedLessonQuizQuestion[];
  };

  if (
    !Array.isArray(generatedQuiz.questions) ||
    generatedQuiz.questions.length !== 5
  ) {
    throw new Error("Kingdom must return exactly 5 quiz questions.");
  }

  const questions = normalizeGeneratedQuestions(generatedQuiz.questions);

  if (process.env.NODE_ENV === "development") {
    console.info(
      "Kingdom lesson quiz normalized payload:",
      questions.map((question) => ({
        question: question.questionText,
        option_a: question.optionA,
        option_b: question.optionB,
        option_c: question.optionC,
        option_d: question.optionD,
        correct_option: question.correctOption,
      })),
    );
  }

  return questions;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const subjectKey =
      typeof body.subjectKey === "string" && isSubjectKey(body.subjectKey)
        ? body.subjectKey
        : "business-studies";
    const subject = getSubjectConfiguration(subjectKey);
    const authorization = await authorizeTeacher(subject.databaseId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }

    const readingTitle =
      typeof body.readingTitle === "string" ? body.readingTitle : "";
    const readingText =
      typeof body.readingText === "string" ? body.readingText : "";

    if (!readingTitle.trim()) {
      return NextResponse.json(
        { error: "A reading title is required." },
        { status: 400 },
      );
    }

    if (!readingText.trim()) {
      return NextResponse.json(
        { error: "Reading text is required before Kingdom can build a quiz." },
        { status: 400 },
      );
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Generate lesson reading quiz",
    });
    const basePrompt = buildLessonQuizPrompt({
      subjectContext,
      readingTitle: readingTitle.trim(),
      readingText: readingText.trim(),
    });

    let questions = await requestLessonQuiz(basePrompt);

    if (hasSingleRepeatedCorrectOption(questions)) {
      const retryPrompt = `${basePrompt}

IMPORTANT CORRECTION:
- Your previous draft used the same correctOption letter for every question.
- Regenerate all 5 questions.
- Set correctOption from the true correct answer for each specific question.
- Use a natural spread of correctOption letters across A-D where the reading allows.
- Do not return all 5 correct answers in the same option position.`;

      questions = await requestLessonQuiz(retryPrompt);
    }

    const incompleteQuestion = questions.find(
      (question) => !isCompleteLessonQuizQuestion(question),
    );

    if (incompleteQuestion) {
      return NextResponse.json(
        {
          error:
            "Kingdom returned an invalid quiz question. Each question must include four options and one valid correct option (A-D).",
        },
        { status: 500 },
      );
    }

    if (hasSingleRepeatedCorrectOption(questions)) {
      return NextResponse.json(
        {
          error:
            "Kingdom returned a quiz with the same correct option for every question. Please generate the quiz again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error("Kingdom lesson quiz generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kingdom could not generate the lesson quiz.",
      },
      { status: 500 },
    );
  }
}
