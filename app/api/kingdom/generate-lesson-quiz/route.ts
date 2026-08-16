import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildLessonQuizPrompt } from "@/lib/kingdom/author/business-studies/cambridge/lessonQuizPrompt";
import {
  buildOpenAIReadingInput,
  extractPdfFileId,
  resolveAuthoritativeLessonReading,
} from "@/lib/kingdom/lessonReadingGeneration";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import { verifyQuestionsAgainstPdf } from "@/lib/kingdom/pdfQuestionVerification";
import { isCompleteLessonQuizQuestion } from "@/lib/lessons/lessonQuiz";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import {
  buildQuizEvidenceIntegrityPrompt,
  pickPdfVerificationDetail,
  quizQuestionClaimsSpecialEvidence,
  validateQuizQuestionsAgainstTextReading,
  type PdfVerificationQuestionInput,
} from "@/lib/subjects/questionEvidenceIntegrity";
import {
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";

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

type LessonQuizResponseInput = NonNullable<
  Parameters<typeof openai.responses.create>[0]["input"]
>;

function toLessonQuizErrorResponse(
  error: unknown,
  readingSourceType: "pasted_text" | "pdf" | null,
) {
  const message =
    error instanceof Error
      ? error.message
      : "Kingdom could not generate the lesson quiz.";

  if (
    message === "Save the lesson reading before Kingdom can build a quiz." ||
    message ===
      "The selected lesson has no reading content for Kingdom to use." ||
    message === "The saved PDF reading could not be resolved securely." ||
    message === "The saved PDF reading is missing or invalid."
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    message === "The selected lesson does not exist." ||
    message ===
      "The saved PDF reading could not be downloaded from secure storage."
  ) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (message === "The selected lesson is not a Business Studies lesson.") {
    return NextResponse.json(
      { error: "The selected lesson cannot be used for this subject." },
      { status: 400 },
    );
  }

  if (readingSourceType === "pdf") {
    return NextResponse.json(
      {
        error:
          "Kingdom could not process the saved PDF reading. Please try again or replace the PDF if the problem continues.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

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

async function requestLessonQuiz(input: LessonQuizResponseInput) {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input,
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
  let cleanup = async () => {};
  let readingSourceType: "pasted_text" | "pdf" | null = null;

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

    const lessonId =
      typeof body.lessonId === "string" ? body.lessonId.trim() : "";

    if (!lessonId) {
      return NextResponse.json(
        { error: "Save the lesson reading before Kingdom can build a quiz." },
        { status: 400 },
      );
    }

    const resolvedReading = await resolveAuthoritativeLessonReading({
      admin: authorization.teacher.admin,
      subjectKey,
      lessonId,
      lessonStatusMode: "draft-or-published",
    });
    readingSourceType = resolvedReading.reading.sourceType;

    const subjectContext = buildKingdomSubjectContext({
      subjectKey,
      role: "Author",
      taskType: "Generate lesson reading quiz",
    });
    const quizEvidenceIntegrityPrompt = buildQuizEvidenceIntegrityPrompt({
      subjectKey,
      readingSourceType: resolvedReading.reading.sourceType,
      readingContent: resolvedReading.reading.contentText,
    });
    const basePrompt = buildLessonQuizPrompt({
      subjectContext,
      readingTitle: resolvedReading.reading.title,
      readingSourceType: resolvedReading.reading.sourceType,
      readingText: resolvedReading.reading.plainText,
      quizEvidenceIntegrityPrompt,
    });

    const readingInput = await buildOpenAIReadingInput({
      admin: authorization.teacher.admin,
      openai,
      resolvedReading,
      pdfDetail: "auto",
    });
    cleanup = readingInput.cleanup;

    const buildResponseInput = (promptText: string) =>
      [
        {
          role: "user" as const,
          content: [
            { type: "input_text" as const, text: promptText },
            ...readingInput.content,
          ],
        },
      ] satisfies LessonQuizResponseInput;

    let questions = await requestLessonQuiz(buildResponseInput(basePrompt));

    if (hasSingleRepeatedCorrectOption(questions)) {
      const retryPrompt = `${basePrompt}

IMPORTANT CORRECTION:
- Your previous draft used the same correctOption letter for every question.
- Regenerate all 5 questions.
- Set correctOption from the true correct answer for each specific question.
- Use a natural spread of correctOption letters across A-D where the reading allows.
- Do not return all 5 correct answers in the same option position.`;

      questions = await requestLessonQuiz(buildResponseInput(retryPrompt));
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

    if (
      resolvedReading.reading.sourceType === "pasted_text" &&
      resolvedReading.reading.contentText
    ) {
      const integrity = validateQuizQuestionsAgainstTextReading({
        subjectKey,
        readingContent: resolvedReading.reading.contentText,
        questions: questions.map((question) => ({
          id: question.id,
          questionText: question.questionText,
        })),
      });

      if (integrity.issues.length > 0) {
        return NextResponse.json(
          {
            error:
              "Kingdom generated one or more quiz questions that require evidence the saved lesson reading does not actually contain.",
            details: integrity.issues.map(
              (issue) => `Question ${issue.questionId}: ${issue.reason}.`,
            ),
          },
          { status: 422 },
        );
      }
    }

    // Independent second-pass verification for PDF-backed quizzes. Quizzes
    // have no per-question evidenceRequirement metadata, so candidates are
    // selected by wording alone (the same detection introduced in Task
    // 2C.2). Ordinary knowledge questions never trigger the extra call.
    if (resolvedReading.reading.sourceType === "pdf") {
      const verificationCandidates: PdfVerificationQuestionInput[] = questions
        .filter((question) =>
          quizQuestionClaimsSpecialEvidence(subjectKey, question.questionText),
        )
        .map((question) => ({
          id: question.id,
          questionText: question.questionText,
        }));

      if (verificationCandidates.length > 0) {
        const pdfFileId = extractPdfFileId(readingInput.content);
        const verificationIssues: string[] = [];

        if (!pdfFileId) {
          verificationIssues.push(
            "Kingdom could not verify one or more source-dependent questions because the PDF could not be reloaded for verification.",
          );
        } else {
          const verificationResults = await verifyQuestionsAgainstPdf({
            openai,
            subjectKey,
            fileId: pdfFileId,
            detail: pickPdfVerificationDetail(verificationCandidates),
            questions: verificationCandidates,
          });

          for (const result of verificationResults) {
            if (!result.supported) {
              verificationIssues.push(
                `Question ${result.questionId}: ${result.reason}`,
              );
            }
          }
        }

        if (verificationIssues.length > 0) {
          return NextResponse.json(
            {
              error:
                "Kingdom generated one or more quiz questions that require evidence the saved PDF reading does not actually contain.",
              details: verificationIssues,
            },
            { status: 422 },
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error("Kingdom lesson quiz generation error:", error);
    return toLessonQuizErrorResponse(error, readingSourceType);
  } finally {
    await cleanup();
  }
}
