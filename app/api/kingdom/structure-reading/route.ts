import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildReadingStructurePrompt } from "@/lib/kingdom/author/business-studies/cambridge/readingStructurePrompt";
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

    const readingTitle = body.readingTitle;
    const teacherContent = body.teacherContent;
    const mode = body.mode;

    if (
      typeof readingTitle !== "string" ||
      !readingTitle.trim() ||
      readingTitle.length > 300 ||
      typeof teacherContent !== "string" ||
      !teacherContent.trim() ||
      teacherContent.length > 60_000 ||
      (mode !== "formatting_only" &&
        mode !== "formatting_and_language")
    ) {
      return NextResponse.json(
        { error: "Add a valid reading title, content, and structure mode." },
        { status: 400 },
      );
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Structure teacher-provided reading",
    });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: buildReadingStructurePrompt({
        subjectContext,
        readingTitle: readingTitle.trim(),
        teacherContent: teacherContent.trim(),
        mode,
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
    console.error("Kingdom reading structure error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error:
          "Kingdom could not structure this reading. Your original content is unchanged.",
      },
      { status: 500 },
    );
  }
}
