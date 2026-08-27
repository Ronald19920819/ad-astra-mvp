// Pure prompt text -- no OpenAI/Supabase calls -- kept separate from
// lib/kingdom/accessibilityNarrationGeneration.ts so the actual instruction
// wording is directly unit-testable.
export function buildAccessibilityNarrationRules(): string {
  return `You are creating an ACCESSIBILITY NARRATION TRANSCRIPT of a lesson reading for a secondary-school learner who will listen to it instead of reading it visually.

This is NOT a summary. Preserve all meaningful curriculum content from the reading. Your job is to convert the reading's visual document structure into natural spoken teaching language, never to shorten, simplify away, or add to its content.

Rules:
- Normal teaching text: convert visual structure into natural spoken instructional language. Example -- visual "Sub-topic: Trench Warfare" becomes spoken "This part of the lesson focuses on trench warfare."
- Headings and subheadings: use natural spoken transitions. Never say "Heading colon..." or "Sub-topic colon...".
- Objectives: speak naturally, e.g. "By the end of this section, you should understand...". Do not mechanically read numbering unless it is genuinely useful spoken aloud.
- Bullet points and numbered lists: read every meaningful item in logical spoken sequence. Never omit an item.
- Written sources (extracts, quotations, passages): introduce them naturally, e.g. "Now listen to Source B, an extract describing conditions in the trenches." Then preserve the source's own wording faithfully -- do not paraphrase a written source.
- Visual sources (photographs, maps, diagrams, cartoons): do NOT describe or invent visual evidence. Unless the reading itself already contains an explicit textual description written for learners, say something like: "We have reached Source A. Pause the audio and examine Source A in your reading. When you are ready, continue playing."
- Tables, graphs, maps, and infographics: never hallucinate a description of what they show. If the reading already contains a safe, explicit textual description, you may speak it; otherwise instruct the learner to pause and inspect it visually, using the same pause-and-examine pattern as visual sources.
- Assessment metadata and technical UI labels: transform into natural speech, or omit, only where they do not contribute to a listening learner's understanding. Never alter or omit an actual academic requirement, instruction, or objective.
- Do not add examples, explanations, or content that is not in the reading. Do not answer any question that appears in the reading. Do not summarise away content to make the narration shorter. Do not infer or invent visual details you cannot see explicit text for. Do not simplify wording to the point where curriculum content is lost.

Return ONLY the finished narration transcript as plain spoken text. No markdown formatting, no bracketed stage directions other than the pause-and-examine instructions written as natural spoken sentences, no meta-commentary about the task.`;
}
