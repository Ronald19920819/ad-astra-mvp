import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildBusinessStudiesKingdomPrompt } from "@/lib/kingdom/author/business-studies/cambridge/promptBuilder";
import {
  buildOpenAIReadingInput,
  resolveAuthoritativeLessonReading,
} from "@/lib/kingdom/lessonReadingGeneration";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  buildUniversalEvidenceIntegrityPrompt,
  type GeneratedQuestionIntegrityCheck,
  validateGeneratedQuestionIntegrity,
  validateQuestionPlansAgainstTextReading,
} from "@/lib/subjects/questionEvidenceIntegrity";
import {
  getQuestionEvidenceRequirement,
} from "@/lib/subjects/questionPresets";
import {
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";

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
  integrityCheck?: GeneratedQuestionIntegrityCheck;
};

type ActivityResponseInput = NonNullable<
  Parameters<typeof openai.responses.create>[0]["input"]
>;

function pickPdfDetail(subjectKey: Parameters<typeof getSubjectConfiguration>[0], questions: ActivityQuestionPlan[]) {
  return questions.some((question) => {
    const requirement =
      typeof question.questionType === "string"
        ? getQuestionEvidenceRequirement(subjectKey, question.questionType)
        : undefined;

    return requirement?.acceptedEvidenceKinds.includes("visual-source");
  })
    ? ("high" as const)
    : ("auto" as const);
}

export async function POST(request: Request) {
  let cleanup = async () => {};

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
        { status: 400 },
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required." },
        { status: 400 },
      );
    }

    const incompleteQuestion = questions.find(
      (question) => !question.paper || !question.questionType,
    );

    if (incompleteQuestion) {
      return NextResponse.json(
        { error: "Select a paper and question type for every question." },
        { status: 400 },
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

    const resolvedReading = await resolveAuthoritativeLessonReading({
      admin: authorization.teacher.admin,
      subjectKey,
      lessonId,
      lessonStatusMode: "published-only",
    });

    if (
      resolvedReading.reading.sourceType === "pasted_text" &&
      resolvedReading.reading.contentText
    ) {
      const preflight = validateQuestionPlansAgainstTextReading({
        subjectKey,
        readingContent: resolvedReading.reading.contentText,
        questions: normalizedQuestions.map((question) => ({
          id: question.id,
          questionType: question.questionType,
          guidance: question.guidance,
        })),
      });

      if (preflight.issues.length > 0) {
        return NextResponse.json(
          {
            error:
              "One or more selected question types need evidence that the saved lesson reading does not actually contain.",
            details: preflight.issues.map(
              (issue) => `Question ${issue.questionId}: ${issue.reason}.`,
            ),
          },
          { status: 422 },
        );
      }
    }

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Generate assessment activity",
    });
    const universalEvidenceIntegrityPrompt =
      buildUniversalEvidenceIntegrityPrompt({
        subjectKey,
        readingSourceType: resolvedReading.reading.sourceType,
        readingContent: resolvedReading.reading.contentText,
        questions: normalizedQuestions.map((question) => ({
          id: question.id,
          questionType: question.questionType,
          guidance: question.guidance,
        })),
      });
    const prompt = buildBusinessStudiesKingdomPrompt({
      subjectContext,
      lessonTitle: resolvedReading.lesson.title,
      lessonReading:
        resolvedReading.reading.plainText ??
        "Authoritative saved lesson reading is attached separately as a PDF file input.",
      readingSourceType: resolvedReading.reading.sourceType,
      activityTitle,
      questions: normalizedQuestions,
      universalEvidenceIntegrityPrompt,
    });

    const readingInput = await buildOpenAIReadingInput({
      admin: authorization.teacher.admin,
      openai,
      resolvedReading,
      pdfDetail: pickPdfDetail(subjectKey, normalizedQuestions),
    });
    cleanup = readingInput.cleanup;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...readingInput.content,
          ],
        },
      ] satisfies ActivityResponseInput,
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      return NextResponse.json(
        { error: "Kingdom returned an empty response." },
        { status: 500 },
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
        { status: 500 },
      );
    }

    const planById = new Map(
      normalizedQuestions.map((question) => [question.id, question]),
    );
    const integrityIssues: string[] = [];

    for (const generatedQuestion of generatedActivity.questions) {
      const plannedQuestion = planById.get(generatedQuestion.id);
      if (!plannedQuestion) {
        integrityIssues.push(
          `Kingdom returned an unexpected question id (${generatedQuestion.id}).`,
        );
        continue;
      }

      const result = validateGeneratedQuestionIntegrity({
        subjectKey,
        questionType: plannedQuestion.questionType,
        guidance: plannedQuestion.guidance,
        questionText: generatedQuestion.questionText ?? "",
        readingSourceType: resolvedReading.reading.sourceType,
        readingContent: resolvedReading.reading.contentText,
        integrityCheck: generatedQuestion.integrityCheck,
      });

      if (!result.ok) {
        integrityIssues.push(
          `Question ${generatedQuestion.id} is not source aligned because ${result.reason}.`,
        );
      }
    }

    if (integrityIssues.length > 0) {
      return NextResponse.json(
        {
          error:
            "Kingdom generated one or more questions that require evidence the learner has not actually been given in the linked lesson reading.",
          details: integrityIssues,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      questions: generatedActivity.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
      })),
    });
  } catch (error) {
    console.error("Kingdom generation error:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kingdom could not generate the activity.",
      },
      { status: 500 },
    );
  } finally {
    await cleanup();
  }
}
