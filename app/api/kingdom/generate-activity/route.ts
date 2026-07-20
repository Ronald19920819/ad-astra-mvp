import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildBusinessStudiesKingdomPrompt } from "@/lib/kingdom/author/business-studies/cambridge/promptBuilder";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { linkedLesson, activityTitle, questions } = body;
    const lessonId = linkedLesson;

    if (typeof lessonId !== "string" || !lessonId.trim()) {
      return NextResponse.json(
        { error: "Select a published lesson before asking Kingdom." },
        { status: 400 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required." },
        { status: 400 }
      );
    }

    const incompleteQuestion = questions.find(
      (question) => !question.paper || !question.questionType
    );

    if (incompleteQuestion) {
      return NextResponse.json(
        { error: "Select a paper and question type for every question." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, subject_id, status")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError) {
      console.error("Kingdom lesson lookup failed:", {
        lessonId,
        code: lessonError.code,
        message: lessonError.message,
      });

      return NextResponse.json(
        { error: "The selected lesson could not be loaded." },
        { status: 500 },
      );
    }

    if (!lesson) {
      return NextResponse.json(
        { error: "The selected lesson does not exist." },
        { status: 404 },
      );
    }

    if (lesson.status !== "published") {
      return NextResponse.json(
        { error: "Only published lessons can be used by Kingdom." },
        { status: 403 },
      );
    }

    if (lesson.subject_id !== businessStudiesSubjectId) {
      return NextResponse.json(
        { error: "The selected lesson is not a Business Studies lesson." },
        { status: 403 },
      );
    }

    const { data: readingMaterial, error: readingError } = await supabase
      .from("lesson_materials")
      .select("id, content_text")
      .eq("lesson_id", lessonId)
      .eq("material_type", "reading")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (readingError) {
      console.error("Kingdom lesson reading lookup failed:", {
        lessonId,
        code: readingError.code,
        message: readingError.message,
      });

      return NextResponse.json(
        { error: "The selected lesson reading could not be loaded." },
        { status: 500 },
      );
    }

    const lessonReading = readingMaterial?.content_text?.trim();

    if (!readingMaterial || !lessonReading) {
      return NextResponse.json(
        {
          error:
            "The selected lesson has no reading content for Kingdom to use.",
        },
        { status: 422 },
      );
    }

    const prompt = buildBusinessStudiesKingdomPrompt({
      lessonTitle: lesson.title,
      lessonReading,
      activityTitle,
      questions,
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

    const generatedActivity = JSON.parse(cleanedOutput);

    if (!Array.isArray(generatedActivity.questions)) {
      return NextResponse.json(
        { error: "Kingdom returned an invalid question structure." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      questions: generatedActivity.questions,
    });
  } catch (error) {
    console.error("Kingdom generation error:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Kingdom could not generate the activity." },
      { status: 500 }
    );
  }
}
