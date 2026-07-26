import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildBusinessStudiesKingdomPrompt } from "@/lib/kingdom/author/business-studies/cambridge/promptBuilder";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import { readingContentToPlainText } from "@/lib/readings/structuredReading";
import {
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const { linkedLesson, questions } = body;
    const activityTitle =
      typeof body.activityTitle === "string" ? body.activityTitle : undefined;
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

    const supabase = authorization.teacher.admin;
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

    if (lesson.subject_id !== subject.databaseId) {
      return NextResponse.json(
        { error: `The selected lesson is not a ${subject.displayName} lesson.` },
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

    const lessonReading = readingContentToPlainText(
      readingMaterial?.content_text ?? null,
    ).trim();

    if (!readingMaterial || !lessonReading) {
      return NextResponse.json(
        {
          error:
            "The selected lesson has no reading content for Kingdom to use.",
        },
        { status: 422 },
      );
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Generate assessment activity",
    });
    const prompt = buildBusinessStudiesKingdomPrompt({
      subjectContext,
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
