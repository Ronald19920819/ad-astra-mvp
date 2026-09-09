// LOCAL-ONLY spike: generates 4 short MP3 samples via OpenAI TTS so we can
// listen to actual voice/model output before choosing the production
// accessibility narration voice. Not part of the app; no DB/Supabase access;
// no learner-facing route. Safe to delete after listening.
//
// Usage: node scripts/test-accessibility-tts.mjs

import OpenAI from "openai";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = {
  ...loadEnv(path.join(repoRoot, ".env")),
  ...loadEnv(path.join(repoRoot, ".env.local")),
  ...process.env,
};

if (!env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not configured. Aborting (key not printed).");
  process.exit(1);
}

// Output goes to the OS temp directory, never inside the git repo, so there
// is no possibility of these MP3s being staged or committed.
const OUTPUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ad-astra-tts-test-"));

const MODEL = "gpt-4o-mini-tts";
const RESPONSE_FORMAT = "mp3";

// Voices chosen from the model's currently documented set. OpenAI's own
// text-to-speech guide states "for best quality, we recommend using `marin`
// or `cedar`" -- both are calm, natural voices suited to long-form narration
// rather than the more theatrical legacy voice set.
const VOICES = [
  { id: "marin", label: "marin" },
  { id: "cedar", label: "cedar" },
];

const DELIVERY_INSTRUCTIONS =
  "Speak as a calm, warm secondary-school teacher. Use clear pronunciation " +
  "and a natural educational pace. Do not sound theatrical or like an " +
  "advertisement. Pause naturally between paragraphs and give slightly " +
  "greater emphasis to instructions telling the learner to pause or " +
  "examine a source.";

const ENGLISH_TEXT = `This part of the lesson focuses on trench warfare on the Western Front. By the end of this section, you should understand why trench systems developed and why they became so difficult to break through.

As the war continued, both sides constructed increasingly complex defensive positions. Trenches provided soldiers with protection from rifle fire, machine guns and artillery, but they also contributed to the military stalemate.

We have now reached Source A. Pause the audio and examine Source A in your reading. When you are ready, continue playing.`;

const AFRIKAANS_TEXT = `Hierdie deel van die les fokus op karakterisering. Teen die einde van hierdie afdeling behoort jy te verstaan hoe 'n skrywer dialoog, handeling en beskrywing gebruik om 'n karakter te ontwikkel.

Wanneer 'n karakter praat, kan die woorde wat hy of sy kies vir die leser belangrike inligting gee oor die karakter se persoonlikheid, gevoelens en houding.

Ons het nou Bron A bereik. Onderbreek die klank en bestudeer Bron A in jou leesstuk. Wanneer jy gereed is, kan jy voortgaan om te luister.`;

const SAMPLES = [
  { language: "english", text: ENGLISH_TEXT },
  { language: "afrikaans", text: AFRIKAANS_TEXT },
];

function estimateTokens(text) {
  // Rough, conservative estimate only (~4 chars/token); good enough for a
  // ballpark cost figure, not billed truth.
  return Math.ceil(text.length / 4);
}

async function main() {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const results = [];
  let totalInputChars = 0;

  for (const voice of VOICES) {
    for (const sample of SAMPLES) {
      const filename = `accessibility-${sample.language}-${voice.label}.mp3`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      totalInputChars += sample.text.length;

      try {
        const response = await client.audio.speech.create({
          model: MODEL,
          voice: voice.id,
          input: sample.text,
          instructions: DELIVERY_INSTRUCTIONS,
          response_format: RESPONSE_FORMAT,
        });

        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
        const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);

        results.push({
          language: sample.language,
          voice: voice.id,
          status: "success",
          path: outputPath,
          sizeKb,
        });
        console.log(`OK   ${filename} (${sizeKb} KB)`);
      } catch (error) {
        results.push({
          language: sample.language,
          voice: voice.id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`FAIL ${filename}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  const estimatedInputTokens = estimateTokens(
    ENGLISH_TEXT + AFRIKAANS_TEXT + DELIVERY_INSTRUCTIONS,
  ) * VOICES.length;
  const estimatedInputCostUsd = (estimatedInputTokens / 1_000_000) * 0.6;

  console.log("\n--- Summary ---");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  for (const result of results) {
    console.log(JSON.stringify(result));
  }
  console.log(
    `\nApprox. input text tokens across all 4 calls: ~${estimatedInputTokens} ` +
      `(~$${estimatedInputCostUsd.toFixed(4)} at $0.60/1M input tokens). ` +
      `Audio-output cost is additional (~$12/1M audio tokens, roughly ` +
      `$0.015/min of generated audio) and cannot be measured client-side.`,
  );
}

main().catch((error) => {
  console.error("Test script failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
