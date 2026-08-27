import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" + browser Audio() usage -- cannot be rendered in a plain
// node:test run, matching this repo's established convention (see
// LessonAccessibilityAudioPlayer.test.ts's header comment for the
// original precedent). These assert structural properties of the real
// source directly.

const SOURCE = readFileSync("components/learners/ListenToQuestionButton.tsx", "utf8");

test("this component performs no entitlement check of its own -- it is rendered ONLY by a parent that already confirmed entitlement server-side (Stage A/learnerAccessibilityStatus); it must never itself decide visibility from a client-supplied flag", () => {
  assert.doesNotMatch(SOURCE, /accessibilityEnabled|accessibility_enabled/);
});

test("L/replay: pressing while idle or after an error always fetches fresh and sets a new .src -- the browser naturally starts any freshly-set src at 0, so 'replay from the beginning' requires no extra reset logic", () => {
  assert.match(SOURCE, /status === "idle" \|\| status === "error"/);
  assert.match(SOURCE, /audioElement\.src = result\.url;/);
});

test("pause/resume is a toggle while playing/paused -- pressing while playing pauses in place (currentTime untouched), pressing while paused calls play\\(\\) again from wherever it left off", () => {
  assert.match(SOURCE, /function pause\(\) \{/);
  assert.match(SOURCE, /function resume\(\)/);
  const pauseFn = SOURCE.match(/function pause\(\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(pauseFn);
  assert.doesNotMatch(pauseFn!, /currentTime/);
  assert.doesNotMatch(pauseFn!, /\.src\s*=/);
});

test("M: playback registers with the shared one-at-a-time controller on both start and resume, and self-clears on natural end/error/pause -- never leaves a stale 'active' registration behind", () => {
  assert.match(SOURCE, /registerActiveQuestionAudio\(audioElement, \(\) => setStatus\("idle"\)\)/);
  assert.match(SOURCE, /clearActiveQuestionAudioIfSelf\(element\)/);
  assert.match(SOURCE, /clearActiveQuestionAudioIfSelf\(audioElement\)/);
});

test("N: a fetch/playback failure shows only the restrained, exact friendly message -- never raw error text, a signed URL, or a question ID", () => {
  assert.match(SOURCE, /const UNAVAILABLE_MESSAGE = "Question audio is unavailable\. Please try again\.";/);
  assert.doesNotMatch(SOURCE, /\{error\.message\}|\{err\.message\}/);
  assert.doesNotMatch(SOURCE, /\{result\.url\}|\{endpoint\}/);
});

test("N: Try Again is offered on error and simply retries the same fresh-fetch path used for a normal first play", () => {
  const errorSection = SOURCE.match(/\{status === "error" && \([\s\S]*?<\/span>\s*\)\}/)?.[0];
  assert.ok(errorSection, "error UI section not found");
  assert.match(errorSection!, /Try Again/);
  assert.match(errorSection!, /playFromStart/);
});

test("no technical audio state (chunk numbers, generation status, raw URLs) is ever shown to the learner -- only 'Listen to Question' / 'Listening...' / 'Loading...' / 'Resume'", () => {
  assert.doesNotMatch(SOURCE, /segment|chunk|generating|not_generated/i);
});

test("S/T: this component makes no network call other than fetching its own audio endpoint -- no draft/answer/submission/completion mutation of any kind", () => {
  const fetchCalls = SOURCE.match(/fetch\([^)]*\)/g) ?? [];
  assert.ok(fetchCalls.length > 0, "expected at least one fetch call (the audio endpoint itself)");
  for (const call of fetchCalls) {
    assert.match(call, /fetch\(endpoint\)/);
  }
  assert.doesNotMatch(SOURCE, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
});

test("the control is a real button with a state-reflecting accessible label, not a bare icon", () => {
  assert.match(SOURCE, /aria-label=\{label\}/);
  assert.match(SOURCE, /const label =/);
});

test("cleanup on unmount stops playback and de-registers from the shared controller, so navigating away from a question never leaves its audio playing in the background", () => {
  const cleanupEffect = SOURCE.match(/useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*?\n    \};\s*\n  \}, \[\]\);/)?.[0];
  assert.ok(cleanupEffect, "unmount cleanup effect not found");
  assert.match(cleanupEffect!, /audioElement\.pause\(\);/);
  assert.match(cleanupEffect!, /clearActiveQuestionAudioIfSelf\(audioElement\);/);
});
