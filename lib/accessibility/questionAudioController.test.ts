import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  clearActiveQuestionAudioIfSelf,
  registerActiveQuestionAudio,
  stopActiveQuestionAudio,
} from "./questionAudioController";

// A minimal fake satisfying the one method this module actually calls
// (pause()) -- no real DOM/browser needed, matching the FakeStorage
// pattern already established in playbackPosition.test.ts.
function fakeAudioElement() {
  let paused = false;
  return {
    pause: () => {
      paused = true;
    },
    get paused() {
      return paused;
    },
  } as unknown as HTMLAudioElement;
}

function isPaused(element: HTMLAudioElement): boolean {
  return (element as unknown as { paused: boolean }).paused;
}

// The controller is a module-level singleton by design (one active clip
// for the whole page) -- reset it before every test so each test starts
// from a known "nothing playing" state, rather than leaking state between
// tests in this same file.
beforeEach(() => {
  stopActiveQuestionAudio();
});

test("M: registering a second element's audio stops the first, and notifies the first that it was stopped by another", () => {
  const first = fakeAudioElement();
  const second = fakeAudioElement();
  let firstNotified = false;
  let secondNotified = false;

  registerActiveQuestionAudio(first, () => {
    firstNotified = true;
  });
  registerActiveQuestionAudio(second, () => {
    secondNotified = true;
  });

  assert.equal(isPaused(first), true, "the first element must be paused");
  assert.equal(firstNotified, true, "the first question's button must be told it was stopped");
  assert.equal(secondNotified, false, "the second question was never displaced");
});

test("registering the SAME element again (e.g. resume() re-registering) does not stop or notify itself", () => {
  const element = fakeAudioElement();
  let notifiedCount = 0;
  registerActiveQuestionAudio(element, () => {
    notifiedCount += 1;
  });
  registerActiveQuestionAudio(element, () => {
    notifiedCount += 1;
  });
  assert.equal(notifiedCount, 0);
  assert.equal(isPaused(element), false, "re-registering the same element must never pause it");
});

test("stopActiveQuestionAudio is a safe no-op when nothing is currently registered", () => {
  assert.doesNotThrow(() => stopActiveQuestionAudio());
});

test("stopActiveQuestionAudio stops and notifies whichever audio is currently active", () => {
  const element = fakeAudioElement();
  let notified = false;
  registerActiveQuestionAudio(element, () => {
    notified = true;
  });
  stopActiveQuestionAudio();
  assert.equal(isPaused(element), true);
  assert.equal(notified, true);
});

test("after stopActiveQuestionAudio, a fresh registration works normally (the singleton is genuinely cleared, not left in a broken state)", () => {
  const first = fakeAudioElement();
  registerActiveQuestionAudio(first, () => {});
  stopActiveQuestionAudio();

  const second = fakeAudioElement();
  let secondNotified = false;
  registerActiveQuestionAudio(second, () => {
    secondNotified = true;
  });
  assert.equal(isPaused(second), false);
  assert.equal(secondNotified, false);
});

test("clearActiveQuestionAudioIfSelf only clears the registration when the given element is still the one actually registered -- a stale call from an already-displaced element never clears a newer registration", () => {
  const first = fakeAudioElement();
  const second = fakeAudioElement();
  let secondNotifiedOfDisplacement = false;

  registerActiveQuestionAudio(first, () => {});
  registerActiveQuestionAudio(second, () => {
    secondNotifiedOfDisplacement = true;
  }); // displaces first

  // A late "ended"/"error" callback from the already-displaced first
  // element must not clear second's registration.
  clearActiveQuestionAudioIfSelf(first);

  const third = fakeAudioElement();
  registerActiveQuestionAudio(third, () => {});
  // If clearActiveQuestionAudioIfSelf(first) had wrongly cleared second's
  // registration, registering third would have found nothing active to
  // stop, and second would never be paused or notified.
  assert.equal(isPaused(second), true, "second must still have been genuinely active and gotten stopped by third");
  assert.equal(secondNotifiedOfDisplacement, true, "second's own callback (registered when second started) must fire when third displaces it");
});

test("clearActiveQuestionAudioIfSelf on the genuinely active element clears it, so a subsequent registration does not try to stop/notify it again", () => {
  const element = fakeAudioElement();
  let notifiedAgain = false;
  registerActiveQuestionAudio(element, () => {
    notifiedAgain = true;
  });
  clearActiveQuestionAudioIfSelf(element);

  const next = fakeAudioElement();
  registerActiveQuestionAudio(next, () => {});
  assert.equal(notifiedAgain, false, "the already self-cleared element must not be notified again");
});
