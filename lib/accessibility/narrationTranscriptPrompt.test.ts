import assert from "node:assert/strict";
import test from "node:test";
import { buildAccessibilityNarrationRules } from "./narrationTranscriptPrompt";

const rules = buildAccessibilityNarrationRules();

test("the rules explicitly forbid mechanical heading narration", () => {
  assert.match(rules, /Never say "Heading colon/);
});

test("the rules require the pause-and-examine pattern for visual sources, and explicitly forbid inventing visual descriptions", () => {
  assert.match(rules, /Pause the audio and examine/);
  assert.match(rules, /do NOT describe or invent visual evidence/);
});

test("the rules require written sources to be preserved faithfully, not paraphrased", () => {
  assert.match(rules, /preserve the source's own wording faithfully/);
});

test("the rules explicitly state this is not a summary and must preserve curriculum content", () => {
  assert.match(rules, /NOT a summary/);
  assert.match(rules, /never to shorten, simplify away, or add to its content/);
});

test("the rules forbid answering questions, adding examples, or inferring unseen visual detail", () => {
  assert.match(rules, /Do not add examples/);
  assert.match(rules, /Do not answer any question/);
  assert.match(rules, /Do not infer or invent visual details/);
});

test("tables/graphs/maps get the same non-hallucination treatment as other visual sources", () => {
  assert.match(rules, /Tables, graphs, maps, and infographics: never hallucinate/);
});
