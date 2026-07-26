import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildReadingGenerationPrompt } from "@/lib/kingdom/author/business-studies/cambridge/readingGenerationPrompt";
import {
  parseStructuredReadingDocument,
  structuredReadingToEditorText,
} from "@/lib/readings/structuredReading";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import {
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function cleanKingdomJson(output: string) {
  return output
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
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
      typeof body.readingTitle === "string" ? body.readingTitle.trim() : "";
    const learnerLevel =
      typeof body.learnerLevel === "string" ? body.learnerLevel.trim() : "";
    const instruction =
      typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (
      !learnerLevel ||
      !instruction ||
      readingTitle.length > 300 ||
      learnerLevel.length > 300 ||
      instruction.length > 20_000
    ) {
      return NextResponse.json(
        {
          error:
            "Phase / learner level and a reading instruction are required.",
        },
        { status: 400 },
      );
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Generate lesson reading",
      stageOrGrade: learnerLevel,
    });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: buildReadingGenerationPrompt({
        subjectContext,
        readingTitle,
        learnerLevel,
        instruction,
      }),
    });
    const outputText = response.output_text?.trim();
    if (!outputText) throw new Error("Kingdom returned an empty response.");

    const document = parseStructuredReadingDocument(
      JSON.parse(cleanKingdomJson(outputText)),
    );
    if (!document) {
      throw new Error("Kingdom returned invalid structured reading data.");
    }

    return NextResponse.json({
      success: true,
      editorText: structuredReadingToEditorText(document),
    });
  } catch (error) {
    console.error("Kingdom reading generation error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error:
          "Kingdom could not generate the reading. Review the plan and try again.",
      },
      { status: 500 },
    );
  }
}
