import "server-only";

import OpenAI from "openai";
import {
  buildKingdomMonthlyReportEvidence,
  buildKingdomMonthlyReportPrompt,
  parseKingdomMonthlyReportComments,
  MONTHLY_REPORT_KINGDOM_COMMENTS_SCHEMA_VERSION,
  type StoredMonthlyReportKingdomComments,
} from "@/lib/reports/kingdomMonthlyReport";
import { hashMonthlyReportSnapshot } from "@/lib/reports/monthlyReportSnapshotHash";
import type { KingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import type { MonthlyReportPayload } from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY REPORT -- STAGE 3: the thin, server-only orchestrator
// around the pure evidence/prompt/parse functions in the sibling
// kingdomMonthlyReport.ts. Kept separate (and untested directly, exactly
// like lib/kingdom/examiner/businessStudiesActivity.ts) so the pure logic
// stays importable from a plain node:test run.
//
// Fails safely: up to two attempts total. If the first response fails
// structural/gendered-language validation, a second attempt is made with
// the specific rejection reason appended to the prompt. If both attempts
// fail, this throws -- the caller must never persist a half-valid or
// unvalidated result.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_ATTEMPTS = 2;

export async function generateKingdomMonthlyReportComments({
  payload,
  subjectContext,
}: {
  payload: MonthlyReportPayload;
  subjectContext: KingdomSubjectContext;
}): Promise<StoredMonthlyReportKingdomComments> {
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = buildKingdomMonthlyReportPrompt({
      evidence,
      subjectContext,
      retryReason: lastError?.message,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    } as never);
    const outputText = response.output_text?.trim();

    if (!outputText) {
      lastError = new Error("Kingdom returned an empty monthly report commentary response.");
      continue;
    }

    try {
      const comments = parseKingdomMonthlyReportComments(outputText);
      return {
        schemaVersion: MONTHLY_REPORT_KINGDOM_COMMENTS_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        snapshotHash: hashMonthlyReportSnapshot(payload),
        comments,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Kingdom could not generate valid monthly report commentary.");
}
