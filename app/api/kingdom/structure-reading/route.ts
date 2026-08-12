import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildReadingStructurePrompt } from "@/lib/kingdom/author/business-studies/cambridge/readingStructurePrompt";
import {
  parseStructuredReadingDocument,
  structuredReadingToEditorText,
  validateStructuredReadingCompleteness,
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

function formatFailure(message: string) {
  return NextResponse.json({ error: message }, { status: 422 });
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
    const mode = "formatting_only" as const;

    if (typeof readingTitle !== "string" || !readingTitle.trim()) {
      return formatFailure("Add a valid reading title before structuring.");
    }

    if (readingTitle.length > 300) {
      return formatFailure("Reading titles must stay below 300 characters.");
    }

    if (typeof teacherContent !== "string" || !teacherContent.trim()) {
      return formatFailure(
        "Add your original reading content before using Structure with Kingdom.",
      );
    }

    if (teacherContent.length > 60_000) {
      return formatFailure(
        "This reading is too long to structure in one step. Please keep it below 60,000 characters.",
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
    if (!outputText) {
      throw new Error("Kingdom returned an empty response.");
    }

    const parsedJson = JSON.parse(cleanKingdomJson(outputText));
    const document = parseStructuredReadingDocument(parsedJson);
    if (!document) {
      return formatFailure(
        "Kingdom could not format the complete reading without losing content. Your original reading has been kept unchanged.",
      );
    }

    const editorText = structuredReadingToEditorText(document);
    const completenessCheck = validateStructuredReadingCompleteness({
      sourceText: teacherContent,
      editorText,
    });

    if (!completenessCheck.ok) {
      console.warn("Kingdom reading completeness check failed:", {
        reason: completenessCheck.reason,
      });
      return formatFailure(
        "Kingdom could not format the complete reading without losing content. Your original reading has been kept unchanged.",
      );
    }

    return NextResponse.json({
      success: true,
      editorText,
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
