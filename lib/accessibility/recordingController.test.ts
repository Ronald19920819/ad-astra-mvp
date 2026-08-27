import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  clearActiveRecordingIfSelf,
  registerActiveRecording,
  stopActiveRecording,
} from "./recordingController";

beforeEach(() => {
  stopActiveRecording();
});

test("J: registering a second recording stops the first, and notifies the first that it was stopped by another", () => {
  const tokenA = {};
  const tokenB = {};
  let aStopped = false;
  let aNotified = false;
  let bNotified = false;

  registerActiveRecording(
    tokenA,
    () => {
      aStopped = true;
    },
    () => {
      aNotified = true;
    },
  );
  registerActiveRecording(
    tokenB,
    () => {},
    () => {
      bNotified = true;
    },
  );

  assert.equal(aStopped, true, "the first recording's MediaRecorder must be stopped");
  assert.equal(aNotified, true, "the first question's button must be told it was stopped");
  assert.equal(bNotified, false, "the second recording was never displaced");
});

test("registering with the SAME token again does not stop or notify itself", () => {
  const token = {};
  let stopCount = 0;
  let notifyCount = 0;
  registerActiveRecording(token, () => stopCount++, () => notifyCount++);
  registerActiveRecording(token, () => stopCount++, () => notifyCount++);
  assert.equal(stopCount, 0);
  assert.equal(notifyCount, 0);
});

test("stopActiveRecording is a safe no-op when nothing is currently recording", () => {
  assert.doesNotThrow(() => stopActiveRecording());
});

test("stopActiveRecording stops and notifies whichever recording is currently active", () => {
  const token = {};
  let stopped = false;
  let notified = false;
  registerActiveRecording(
    token,
    () => {
      stopped = true;
    },
    () => {
      notified = true;
    },
  );
  stopActiveRecording();
  assert.equal(stopped, true);
  assert.equal(notified, true);
});

test("clearActiveRecordingIfSelf only clears when the given token is still the one actually registered -- a stale call from an already-displaced session never clears a newer one", () => {
  const tokenA = {};
  const tokenB = {};
  let bStopped = false;
  let bNotifiedOfDisplacement = false;

  registerActiveRecording(tokenA, () => {}, () => {});
  registerActiveRecording(
    tokenB,
    () => {
      bStopped = true;
    },
    () => {
      bNotifiedOfDisplacement = true;
    },
  );

  // A late self-stop call from the already-displaced A must not clear B.
  clearActiveRecordingIfSelf(tokenA);

  const tokenC = {};
  registerActiveRecording(tokenC, () => {}, () => {});
  // If clearActiveRecordingIfSelf(tokenA) had wrongly cleared B's
  // registration, registering C would have found nothing active to stop,
  // and B would never be stopped or notified.
  assert.equal(bStopped, true, "B must still have been genuinely active and gotten stopped by C");
  assert.equal(bNotifiedOfDisplacement, true);
});

test("clearActiveRecordingIfSelf on the genuinely active token clears it, so a subsequent registration finds nothing to stop", () => {
  const token = {};
  let notifiedAgain = false;
  registerActiveRecording(token, () => {}, () => {
    notifiedAgain = true;
  });
  clearActiveRecordingIfSelf(token);

  let nextStopped = false;
  registerActiveRecording({}, () => {
    nextStopped = true;
  }, () => {});
  assert.equal(nextStopped, false, "nothing should be active to stop after a genuine self-clear");
  assert.equal(notifiedAgain, false);
});
