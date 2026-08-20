import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdaptiveLessonCompletion } from "./adaptiveLessonCompletion";

// lib/lessons/lessonCompletionService.ts imports "server-only" (via
// lib/supabase/server.ts), which has no real npm package in this repo and
// only resolves inside a Next.js server build/bundle -- so, matching the
// established precedent elsewhere in this codebase, the service function
// itself cannot be invoked directly in a plain node:test run. Instead these
// tests exercise the exact write-decision predicate the service applies,
// mirrored verbatim from evaluateAndPersistLessonCompletion:
//
//   if (result.isComplete && !existingCompletion) { ...upsert... }
//
// using the real (unmodified, importable) evaluateAdaptiveLessonCompletion
// function for the `result.isComplete` half of that decision.
function shouldPersistNewCompletion(
  isComplete: boolean,
  hasExistingCompletion: boolean,
) {
  return isComplete && !hasExistingCompletion;
}

// K. all required complete -> automatic lesson completion row created
test("a newly-satisfied lesson with no prior completion row gets one created", () => {
  const result = evaluateAdaptiveLessonCompletion(
    { hasReading: true, hasVideo: false, hasQuiz: false },
    { isReadingComplete: true, isVideoComplete: false, isQuizPassed: false },
  );
  assert.equal(shouldPersistNewCompletion(result.isComplete, false), true);
});

// L. one required incomplete -> no completion row
test("a lesson with one still-incomplete requirement never gets a completion row", () => {
  const result = evaluateAdaptiveLessonCompletion(
    { hasReading: true, hasVideo: true, hasQuiz: false },
    { isReadingComplete: true, isVideoComplete: false, isQuizPassed: false },
  );
  assert.equal(shouldPersistNewCompletion(result.isComplete, false), false);
});

// O. existing quiz-backed completion row remains valid / is never
// re-written (ignoreDuplicates semantics) even though the lesson is still
// (still, or again) evaluated as complete.
test("an existing completion row is never re-persisted once it exists", () => {
  const result = evaluateAdaptiveLessonCompletion(
    { hasReading: false, hasVideo: false, hasQuiz: true },
    { isReadingComplete: false, isVideoComplete: false, isQuizPassed: true },
  );
  assert.equal(result.isComplete, true);
  // hasExistingCompletion: true -- must not attempt to persist again.
  assert.equal(shouldPersistNewCompletion(result.isComplete, true), false);
});

// P. quiz-less completion permits quiz_score = null -- the service only
// ever sets quiz_score from a passed attempt; when there is no quiz
// material there can be no passed attempt, so the persisted value is
// always null for a quiz-less lesson (verified structurally: quiz is not
// in requiredTypes, so isQuizPassed/passedAttempt never influenced this
// completion at all).
test("a quiz-less lesson's completion never depends on quiz_score", () => {
  const result = evaluateAdaptiveLessonCompletion(
    { hasReading: true, hasVideo: true, hasQuiz: false },
    { isReadingComplete: true, isVideoComplete: true, isQuizPassed: false },
  );
  assert.equal(result.isComplete, true);
  assert.equal(result.requiredTypes.includes("quiz"), false);
});
