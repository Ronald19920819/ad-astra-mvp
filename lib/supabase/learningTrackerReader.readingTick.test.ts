import assert from "node:assert/strict";
import test from "node:test";

// lib/supabase/learningTrackerReader.ts imports "server-only", which has no
// real npm package in this repo and only resolves inside a Next.js
// server build/bundle -- so, matching the established precedent elsewhere
// in this codebase (see lib/lessons/lessonCompletionService.test.ts), the
// reader cannot be invoked directly in a plain node:test run. Instead this
// mirrors the exact tick-derivation logic verbatim from
// getSubjectLearningTracker's per-learner mapping in
// lib/supabase/learningTrackerReader.ts, with this comment citing the real
// source so the two are kept in sync intentionally rather than by accident.
//
// Product decision under test: a passed quiz is accepted evidence of
// reading completion, in addition to the genuine reading_completed_at
// signal -- display-only, never written back, never feeds
// lib/lessons/adaptiveLessonCompletion.ts.
type TrackerContentState = "complete" | "partial" | "not_started" | "unavailable";

function deriveTrackerTicks({
  hasVideo,
  hasReading,
  hasQuiz,
  videoPercentage,
  videoStarted,
  readingCompletedAt,
  quizCompleted,
  quizSuccessful,
}: {
  hasVideo: boolean;
  hasReading: boolean;
  hasQuiz: boolean;
  videoPercentage: number;
  videoStarted: boolean;
  readingCompletedAt: string | null;
  quizCompleted: boolean;
  quizSuccessful: boolean;
}): { video: TrackerContentState; reading: TrackerContentState; quiz: TrackerContentState } {
  const VIDEO_COMPLETION_THRESHOLD_PERCENT = 90;
  const video: TrackerContentState = !hasVideo
    ? "unavailable"
    : videoPercentage >= VIDEO_COMPLETION_THRESHOLD_PERCENT
      ? "complete"
      : videoStarted
        ? "partial"
        : "not_started";
  const reading: TrackerContentState = !hasReading
    ? "unavailable"
    : readingCompletedAt || quizSuccessful
      ? "complete"
      : "not_started";
  const quiz: TrackerContentState = !hasQuiz
    ? "unavailable"
    : quizSuccessful
      ? "complete"
      : quizCompleted
        ? "partial"
        : "not_started";
  return { video, reading, quiz };
}

const base = {
  hasVideo: false,
  hasReading: false,
  hasQuiz: false,
  videoPercentage: 0,
  videoStarted: false,
  readingCompletedAt: null as string | null,
  quizCompleted: false,
  quizSuccessful: false,
};

// 1. reading + quiz, quiz passed -> Reading complete, Quiz complete
test("reading + quiz, quiz passed marks both Reading and Quiz complete", () => {
  const ticks = deriveTrackerTicks({
    ...base,
    hasReading: true,
    hasQuiz: true,
    quizCompleted: true,
    quizSuccessful: true,
  });
  assert.equal(ticks.reading, "complete");
  assert.equal(ticks.quiz, "complete");
});

// 2. reading + quiz, quiz not passed -> Reading not complete, Quiz not complete
test("reading + quiz, quiz not passed leaves both Reading and Quiz incomplete", () => {
  const ticks = deriveTrackerTicks({
    ...base,
    hasReading: true,
    hasQuiz: true,
    quizCompleted: true,
    quizSuccessful: false,
  });
  assert.equal(ticks.reading, "not_started");
  assert.equal(ticks.quiz, "partial");
});

// 3. no reading, quiz passed -> Reading not applicable, Quiz complete
test("no reading material, quiz passed leaves Reading unavailable but Quiz complete", () => {
  const ticks = deriveTrackerTicks({
    ...base,
    hasReading: false,
    hasQuiz: true,
    quizCompleted: true,
    quizSuccessful: true,
  });
  assert.equal(ticks.reading, "unavailable");
  assert.equal(ticks.quiz, "complete");
});

// 4. video + reading + quiz, quiz passed + video complete -> all three complete
test("video + reading + quiz, quiz passed and video complete marks all three complete", () => {
  const ticks = deriveTrackerTicks({
    hasVideo: true,
    hasReading: true,
    hasQuiz: true,
    videoPercentage: 95,
    videoStarted: true,
    readingCompletedAt: null,
    quizCompleted: true,
    quizSuccessful: true,
  });
  assert.equal(ticks.video, "complete");
  assert.equal(ticks.reading, "complete");
  assert.equal(ticks.quiz, "complete");
});

// 5. video + reading + quiz, quiz passed + video incomplete -> Reading/Quiz
// complete, Video stays independently incomplete
test("video + reading + quiz, quiz passed but video incomplete leaves Video independent", () => {
  const ticks = deriveTrackerTicks({
    hasVideo: true,
    hasReading: true,
    hasQuiz: true,
    videoPercentage: 40,
    videoStarted: true,
    readingCompletedAt: null,
    quizCompleted: true,
    quizSuccessful: true,
  });
  assert.equal(ticks.reading, "complete");
  assert.equal(ticks.quiz, "complete");
  assert.equal(ticks.video, "partial");
});

// 6. reading only -> do not falsely mark reading complete from a
// nonexistent quiz (no quiz material means quizSuccessful can never be
// true, but this asserts the derivation explicitly rather than by omission)
test("reading-only lesson never fabricates reading completion from a nonexistent quiz", () => {
  const ticks = deriveTrackerTicks({
    ...base,
    hasReading: true,
    hasQuiz: false,
    quizCompleted: false,
    quizSuccessful: false,
  });
  assert.equal(ticks.reading, "not_started");
  assert.equal(ticks.quiz, "unavailable");

  // Genuine reading_completed_at signal still independently marks it
  // complete when the quiz doesn't exist to provide evidence.
  const withGenuineSignal = deriveTrackerTicks({
    ...base,
    hasReading: true,
    hasQuiz: false,
    readingCompletedAt: "2026-08-01T00:00:00.000Z",
  });
  assert.equal(withGenuineSignal.reading, "complete");
});
