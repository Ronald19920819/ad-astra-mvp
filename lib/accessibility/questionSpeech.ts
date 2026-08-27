// Pure, deterministic spoken-script construction for Stage C ("Listen to
// Question"). No AI rewriting: the script is built directly from the
// existing learner-facing database fields, so the exact same input always
// produces the exact same script -- this is what makes content-addressed
// caching (lib/kingdom/questionAudioGeneration.ts) safe.
//
// Deliberately excluded, even though present in the underlying tables:
// correct_option (never learner-facing), guidance (Kingdom marking-only,
// never rendered to the learner in SubjectActivityPage.tsx), paper
// (teacher/internal classification, never rendered to the learner), and
// assessment_objective (a short classification badge like "AO2" -- not
// part of "the question" itself, and reading a code aloud would violate
// the "never mechanically read fragments" rule this stage is built on).

export type QuestionSpeechLanguage = "english" | "afrikaans";

export type QuestionSpeechOptions = {
  A?: string | null;
  B?: string | null;
  C?: string | null;
  D?: string | null;
};

export type QuestionSpeechInput = {
  questionText: string;
  // Absent/empty options are never spoken and never inferred -- only
  // genuinely populated options produce a spoken line. A question with no
  // options at all (the real shape for every current activity question)
  // is treated as free-response.
  options?: QuestionSpeechOptions | null;
  marks?: number | null;
  language: QuestionSpeechLanguage;
};

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const OPTION_LABEL: Record<QuestionSpeechLanguage, string> = {
  english: "Option",
  afrikaans: "Opsie",
};

// English/Afrikaans natural singular/plural marks wording. Never
// mechanical ("open bracket four close bracket") -- see AGENTS/Stage C
// spec section 4.
function buildMarksLine(language: QuestionSpeechLanguage, marks: number): string {
  if (language === "afrikaans") {
    return marks === 1
      ? "Hierdie vraag tel 1 punt."
      : `Hierdie vraag tel ${marks} punte.`;
  }
  return marks === 1
    ? "This question is worth 1 mark."
    : `This question is worth ${marks} marks.`;
}

// Only ever reads: the question text, then (for a multiple-choice
// question) each genuinely populated option in order, OR (for a
// free-response question) a natural marks line if marks are known. Never
// both -- matches the spec's own worked examples exactly.
export function buildQuestionSpeechScript(input: QuestionSpeechInput): string {
  const questionText = input.questionText.trim();
  const parts: string[] = [questionText];

  const optionLines = OPTION_LETTERS.flatMap((letter) => {
    const text = input.options?.[letter];
    if (!text || !text.trim()) return [];
    return [`${OPTION_LABEL[input.language]} ${letter}. ${text.trim()}.`];
  });

  if (optionLines.length > 0) {
    parts.push(...optionLines);
  } else if (typeof input.marks === "number" && Number.isFinite(input.marks) && input.marks > 0) {
    parts.push(buildMarksLine(input.language, input.marks));
  }

  return parts.join("\n\n");
}

// The exact string hashed for cache-identity purposes
// (lib/kingdom/questionAudioGeneration.ts) -- binds the script to the
// language and voice it was spoken in, so a future per-subject voice
// change can never silently reuse audio recorded in a different voice,
// even if the script text itself happened to be identical.
export function buildQuestionSpeechCacheInput(args: {
  script: string;
  language: QuestionSpeechLanguage;
  voice: string;
}): string {
  return `${args.language}:${args.voice}:${args.script}`;
}
