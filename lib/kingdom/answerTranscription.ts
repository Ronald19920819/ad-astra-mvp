import "server-only";

import OpenAI, { toFile } from "openai";

// Stage D ("Record Answer") speech-to-text model.
//
// v1 shipped with gpt-4o-transcribe. A real manual test (a genuine
// ~40-second recording) came back as just "This is a test" -- a full
// pipeline audit (client chunk accumulation, Blob assembly, upload,
// server body handling, response handling) found no bug anywhere in
// this app's code, and OpenAI's own developer community independently
// documents gpt-4o-transcribe/gpt-4o-mini-transcribe as currently
// producing truncated or unrelated output for some recordings, with
// affected users confirming whisper-1 returns the complete transcript
// for the SAME audio. whisper-1 is the model actually shipped here as a
// result -- see also lib/accessibility/transcriptPlausibility.ts, the
// safeguard added alongside this switch so a future provider-side
// regression of this kind is caught rather than silently accepted.
export const ANSWER_TRANSCRIPTION_MODEL = "whisper-1";

// Plain transcription only -- see lib/accessibility/questionSpeech.ts's
// sibling doc comment for the same principle applied to question audio.
// This function must NEVER be extended to pass the output through the
// Responses API, Kingdom, a grammar/cleanup LLM, or a translation step.
// The STT model's own output IS the learner's answer text, verbatim.
export async function transcribeAnswerAudio(args: {
  audioBuffer: Buffer;
  fileName: string;
  mimeType: string;
  languageCode: "en" | "af";
}): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const file = await toFile(args.audioBuffer, args.fileName, {
    type: args.mimeType,
  });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: ANSWER_TRANSCRIPTION_MODEL,
    language: args.languageCode,
  });

  return transcription.text;
}
