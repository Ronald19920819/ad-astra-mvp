import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAdaptiveLessonCompletion,
  isLessonCompletionLate,
  isVideoProgressComplete,
} from "./adaptiveLessonCompletion";

const none = { hasReading: false, hasVideo: false, hasQuiz: false };
const noSignals = {
  isReadingComplete: false,
  isVideoComplete: false,
  isQuizPassed: false,
};

// A. reading-only lesson -> complete when reading complete
test("reading-only lesson is complete once reading is complete", () => {
  const availability = { ...none, hasReading: true };
  const incomplete = evaluateAdaptiveLessonCompletion(availability, noSignals);
  assert.equal(incomplete.isComplete, false);
  assert.deepEqual(incomplete.requiredTypes, ["reading"]);

  const complete = evaluateAdaptiveLessonCompletion(availability, {
    ...noSignals,
    isReadingComplete: true,
  });
  assert.equal(complete.isComplete, true);
});

// B. video-only lesson -> complete when video complete
test("video-only lesson is complete once video is complete", () => {
  const availability = { ...none, hasVideo: true };
  const incomplete = evaluateAdaptiveLessonCompletion(availability, noSignals);
  assert.equal(incomplete.isComplete, false);

  const complete = evaluateAdaptiveLessonCompletion(availability, {
    ...noSignals,
    isVideoComplete: true,
  });
  assert.equal(complete.isComplete, true);
});

// C. quiz-only lesson -> complete when quiz passed
test("quiz-only lesson is complete once the quiz is passed", () => {
  const availability = { ...none, hasQuiz: true };
  const incomplete = evaluateAdaptiveLessonCompletion(availability, noSignals);
  assert.equal(incomplete.isComplete, false);

  const complete = evaluateAdaptiveLessonCompletion(availability, {
    ...noSignals,
    isQuizPassed: true,
  });
  assert.equal(complete.isComplete, true);
});

// D. reading + video -> both required
test("reading + video requires both", () => {
  const availability = { ...none, hasReading: true, hasVideo: true };
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isReadingComplete: true,
    }).isComplete,
    false,
  );
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isVideoComplete: true,
    }).isComplete,
    false,
  );
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isReadingComplete: true,
      isVideoComplete: true,
    }).isComplete,
    true,
  );
});

// E. reading + quiz -> both required
test("reading + quiz requires both", () => {
  const availability = { ...none, hasReading: true, hasQuiz: true };
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isReadingComplete: true,
    }).isComplete,
    false,
  );
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isReadingComplete: true,
      isQuizPassed: true,
    }).isComplete,
    true,
  );
});

// F. video + quiz -> both required
test("video + quiz requires both", () => {
  const availability = { ...none, hasVideo: true, hasQuiz: true };
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isVideoComplete: true,
    }).isComplete,
    false,
  );
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      ...noSignals,
      isVideoComplete: true,
      isQuizPassed: true,
    }).isComplete,
    true,
  );
});

// G. reading + video + quiz -> all required
test("reading + video + quiz requires all three", () => {
  const availability = { hasReading: true, hasVideo: true, hasQuiz: true };
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      isReadingComplete: true,
      isVideoComplete: true,
      isQuizPassed: false,
    }).isComplete,
    false,
  );
  assert.equal(
    evaluateAdaptiveLessonCompletion(availability, {
      isReadingComplete: true,
      isVideoComplete: true,
      isQuizPassed: true,
    }).isComplete,
    true,
  );
});

// H. missing video -> video not required
test("a lesson without video material never requires video", () => {
  const availability = { hasReading: true, hasVideo: false, hasQuiz: true };
  const result = evaluateAdaptiveLessonCompletion(availability, {
    isReadingComplete: true,
    isVideoComplete: false,
    isQuizPassed: true,
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.requiredTypes.includes("video"), false);
});

// I. missing quiz -> quiz not required
test("a lesson without quiz material never requires a quiz pass", () => {
  const availability = { hasReading: true, hasVideo: true, hasQuiz: false };
  const result = evaluateAdaptiveLessonCompletion(availability, {
    isReadingComplete: true,
    isVideoComplete: true,
    isQuizPassed: false,
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.requiredTypes.includes("quiz"), false);
});

// J. missing reading -> reading not required
test("a lesson without reading material never requires reading", () => {
  const availability = { hasReading: false, hasVideo: true, hasQuiz: true };
  const result = evaluateAdaptiveLessonCompletion(availability, {
    isReadingComplete: false,
    isVideoComplete: true,
    isQuizPassed: true,
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.requiredTypes.includes("reading"), false);
});

test("a lesson with no materials at all is never auto-complete", () => {
  const result = evaluateAdaptiveLessonCompletion(none, noSignals);
  assert.equal(result.isComplete, false);
  assert.deepEqual(result.requiredTypes, []);
});

test("isVideoProgressComplete uses the 90% threshold", () => {
  assert.equal(isVideoProgressComplete(89.9), false);
  assert.equal(isVideoProgressComplete(90), true);
  assert.equal(isVideoProgressComplete(100), true);
});

// M/N support: late vs on-time vs no-due-date completion timing.
test("isLessonCompletionLate compares completion date against the expected date", () => {
  assert.equal(isLessonCompletionLate("2026-08-20T10:00:00Z", "2026-08-19"), true);
  assert.equal(isLessonCompletionLate("2026-08-19T10:00:00Z", "2026-08-19"), false);
  assert.equal(isLessonCompletionLate("2026-08-18T10:00:00Z", "2026-08-19"), false);
  assert.equal(isLessonCompletionLate("2026-08-20T10:00:00Z", null), false);
});
