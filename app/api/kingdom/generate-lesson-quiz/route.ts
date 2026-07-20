import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildLessonQuizPrompt } from "@/lib/kingdom/author/business-studies/cambridge/lessonQuizPrompt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { readingTitle, readingText } = body;

    if (!readingTitle?.trim()) {
      return NextResponse.json(
        { error: "A reading title is required." },
        { status: 400 }
      );
    }

    if (!readingText?.trim()) {
      return NextResponse.json(
        { error: "Reading text is required before Kingdom can build a quiz." },
        { status: 400 }
      );
    }

    const prompt = buildLessonQuizPrompt({
      readingTitle: readingTitle.trim(),
      readingText: readingText.trim(),
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      return NextResponse.json(
        { error: "Kingdom returned an empty response." },
        { status: 500 }
      );
    }

    const cleanedOutput = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const generatedQuiz = JSON.parse(cleanedOutput);

    if (
      !Array.isArray(generatedQuiz.questions) ||
      generatedQuiz.questions.length !== 10
    ) {
      return NextResponse.json(
        { error: "Kingdom must return exactly 10 quiz questions." },
        { status: 500 }
      );
    }

    const questions = generatedQuiz.questions.map(
      (
        question: {
          questionText?: string;
          answerText?: string;
        },
        index: number
      ) => ({
        id: index + 1,
        questionText: question.questionText?.trim() || "",
        answerText: question.answerText?.trim() || "",
        marks: 1 as const,
      })
    );

    const incompleteQuestion = questions.find(
  (question: {
    id: number;
    questionText: string;
    answerText: string;
    marks: 1;
  }) => !question.questionText || !question.answerText
);

    if (incompleteQuestion) {
      return NextResponse.json(
        { error: "Kingdom returned an incomplete quiz question." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error("Kingdom lesson quiz generation error:", error);

    return NextResponse.json(
      { error: "Kingdom could not generate the lesson quiz." },
      { status: 500 }
    );
  }
}