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
import {
  hasSufficientEvidenceForQuestion,
  isLanguageSubjectKey,
} from "@/lib/subjects/languageSourceIntegrity";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ActivityQuestionPlan = {
  id: number;
  paper?: string;
  questionType?: string;
  marks?: string;
  ao?: string;
  guidance?: string;
};

type GeneratedActivityQuestion = {
  id: number;
  questionText: string;
};

function validateLanguageSourceIntegrity(args: {
  subjectKey: Parameters<typeof getSubjectConfiguration>[0];
  readingContent: string;
  generatedQuestions: GeneratedActivityQuestion[];
  plannedQuestions: ActivityQuestionPlan[];
}) {
  if (!isLanguageSubjectKey(args.subjectKey)) {
    return [] as string[];
  }

  const planById = new Map(
    args.plannedQuestions.map((question) => [question.id, question]),
  );

  return args.generatedQuestions.flatMap((question) => {
    const plan = planById.get(question.id);
    const result = hasSufficientEvidenceForQuestion({
      subjectKey: args.subjectKey,
      questionText: question.questionText,
      questionType: plan?.questionType ?? null,
      guidance: plan?.guidance ?? null,
      readingContent: args.readingContent,
    });

    if (result.ok) {
      return [];
    }

    if (result.reason === "not_required" || result.reason === "sufficient") {
      return [];
    }

    const reasons: Record<typeof result.reason, string> = {
      no_substantial_source:
        "the lesson reading does not contain a substantial learner-facing source",
      insufficient_examples:
        "the lesson reading does not contain enough defensible evidence for the requested examples",
      missing_second_text:
        "the lesson reading does not contain two suitable texts to compare",
      insufficient_structure:
        "the lesson reading does not contain enough structure to support the requested beginning/end analysis",
      insufficient_quoted_material:
        "the lesson reading does not contain enough quotable material for the requested evidence",
    };

    return [
      `Question ${question.id} is not source aligned because ${reasons[result.reason]}. Generated text: ${question.questionText}`,
    ];
  });
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

    const normalizedQuestions = (questions as ActivityQuestionPlan[]).map(
      (question) => ({
        id: question.id,
        paper: String(question.paper ?? ""),
        questionType: String(question.questionType ?? ""),
        marks: String(question.marks ?? ""),
        ao: typeof question.ao === "string" ? question.ao : "",
        guidance:
          typeof question.guidance === "string" ? question.guidance : "",
      }),
    );

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
      questions: normalizedQuestions,
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

    const generatedActivity = JSON.parse(cleanedOutput) as {
      questions?: GeneratedActivityQuestion[];
    };

    if (!Array.isArray(generatedActivity.questions)) {
      return NextResponse.json(
        { error: "Kingdom returned an invalid question structure." },
        { status: 500 }
      );
    }

    const sourceIntegrityIssues = validateLanguageSourceIntegrity({
      subjectKey,
      readingContent: readingMaterial.content_text ?? lessonReading,
      generatedQuestions: generatedActivity.questions,
      plannedQuestions: normalizedQuestions,
    });

    if (sourceIntegrityIssues.length > 0) {
      return NextResponse.json(
        {
          error:
            "Kingdom generated one or more language questions that require source evidence the learner has not actually been given. Review the reading source material or regenerate with source-aligned questions.",
          details: sourceIntegrityIssues,
        },
        { status: 422 },
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