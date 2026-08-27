import "server-only";

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildKingdomPromptPipeline } from "@/lib/kingdom/promptPipeline";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import {
  buildOpenAIReadingInput,
  resolveAuthoritativeLessonReading,
} from "@/lib/kingdom/lessonReadingGeneration";
import { buildAccessibilityNarrationRules } from "@/lib/accessibility/narrationTranscriptPrompt";
import type { SubjectKey } from "@/lib/subjects/subjectConfig";

export type GeneratedAccessibilityNarration = {
  transcript: string;
  sourceType: "pasted_text" | "pdf";
  // Raw content_text (the StructuredReadingDocument JSON) for pasted_text
  // -- ground truth for validatePastedTextNarration, which parses it into
  // blocks itself so it can exclude headings from the strict completeness
  // check. Null for pdf, which has no extracted text anywhere in this app
  // (see narrationIntegrity.ts).
  sourceContentText: string | null;
  readingMaterialId: string;
};

// Reuses the exact same authoritative-reading resolution and PDF file-input
// pattern already proven by Kingdom's activity/quiz generation and marking
// (lib/kingdom/lessonReadingGeneration.ts) -- this file adds only the
// accessibility-specific narration instructions on top, never a second way
// of reading a lesson's reading material.
export async function generateAccessibilityNarrationTranscript(args: {
  admin: SupabaseClient;
  subjectKey: SubjectKey;
  lessonId: string;
}): Promise<GeneratedAccessibilityNarration> {
  const resolved = await resolveAuthoritativeLessonReading({
    admin: args.admin,
    subjectKey: args.subjectKey,
    lessonId: args.lessonId,
    lessonStatusMode: "draft-or-published",
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const readingInput = await buildOpenAIReadingInput({
    admin: args.admin,
    openai,
    resolvedReading: resolved,
    pdfDetail: "high",
  });

  try {
    const subjectContext = buildKingdomSubjectContext({
      subjectKey: args.subjectKey,
      role: "Author",
      taskType:
        "Generate an accessibility narration transcript of a lesson reading, for text-to-speech playback by a learner who needs to listen instead of read.",
    });

    const prompt = buildKingdomPromptPipeline({
      subjectContext,
      roleInstruction:
        "You are AD Astra's Accessibility Narrator. You transform an authoritative lesson reading into a faithful spoken-language narration transcript for an accessibility-enabled learner. You never invent, summarise away, or answer on behalf of the learner.",
      currentTask:
        "Produce one complete accessibility narration transcript for the reading supplied below.",
      prompt: buildAccessibilityNarrationRules(),
    });

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
      ] as never,
    });

    const transcript = response.output_text?.trim();
    if (!transcript) {
      throw new Error("Kingdom returned an empty accessibility narration transcript.");
    }

    return {
      transcript,
      sourceType: resolved.reading.sourceType,
      sourceContentText:
        resolved.reading.sourceType === "pasted_text"
          ? resolved.reading.contentText
          : null,
      readingMaterialId: resolved.reading.id,
    };
  } finally {
    await readingInput.cleanup();
  }
}
