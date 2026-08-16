import type OpenAI from "openai";
import {
  buildPdfQuestionVerificationPrompt,
  type PdfVerificationQuestionInput,
} from "@/lib/subjects/questionEvidenceIntegrity";
import type { SubjectKey } from "@/lib/subjects/subjectConfig";

export type PdfVerificationResult = {
  questionId: number;
  supported: boolean;
  reason: string;
};

const UNVERIFIABLE_REASON =
  "Kingdom could not verify that this generated question is supported by the PDF. Please try again or choose another question type.";

function failClosed(
  questions: PdfVerificationQuestionInput[],
  reason: string,
): PdfVerificationResult[] {
  return questions.map((question) => ({
    questionId: question.id,
    supported: false,
    reason,
  }));
}

/**
 * Independent, second model pass that inspects the SAME uploaded PDF and
 * confirms whether each candidate question is genuinely supported. This is
 * deliberately separate from the generation call's own self-reported
 * integrityCheck — the generation model must not be the sole judge of its
 * own output. Any failure to load, call, or parse a determinable result
 * fails CLOSED (treated as unsupported), never open.
 */
export async function verifyQuestionsAgainstPdf(args: {
  openai: OpenAI;
  subjectKey: SubjectKey;
  fileId: string;
  detail: "auto" | "high";
  questions: PdfVerificationQuestionInput[];
}): Promise<PdfVerificationResult[]> {
  if (args.questions.length === 0) return [];

  const prompt = buildPdfQuestionVerificationPrompt({
    subjectKey: args.subjectKey,
    questions: args.questions,
  });

  let outputText: string | undefined;

  try {
    const response = await args.openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_file",
              file_id: args.fileId,
              detail: args.detail,
            },
          ],
        },
      ],
    });

    outputText = response.output_text?.trim();
  } catch (error) {
    console.error("Kingdom PDF question verification request failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return failClosed(args.questions, UNVERIFIABLE_REASON);
  }

  if (!outputText) {
    return failClosed(args.questions, UNVERIFIABLE_REASON);
  }

  let parsed: { results?: unknown };

  try {
    const cleanedOutput = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    parsed = JSON.parse(cleanedOutput) as { results?: unknown };
  } catch (error) {
    console.error("Kingdom PDF question verification response was not valid JSON:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return failClosed(args.questions, UNVERIFIABLE_REASON);
  }

  if (!Array.isArray(parsed.results)) {
    return failClosed(args.questions, UNVERIFIABLE_REASON);
  }

  const resultById = new Map<number, { supported?: unknown; reason?: unknown }>();
  for (const entry of parsed.results) {
    if (
      entry &&
      typeof entry === "object" &&
      Number.isInteger((entry as { questionId?: unknown }).questionId)
    ) {
      resultById.set((entry as { questionId: number }).questionId, entry);
    }
  }

  return args.questions.map((question) => {
    const entry = resultById.get(question.id);

    if (!entry || typeof entry.supported !== "boolean") {
      return {
        questionId: question.id,
        supported: false,
        reason: UNVERIFIABLE_REASON,
      };
    }

    return {
      questionId: question.id,
      supported: entry.supported,
      reason:
        typeof entry.reason === "string" && entry.reason.trim()
          ? entry.reason.trim()
          : "Kingdom did not give a reason for this verification result.",
    };
  });
}
