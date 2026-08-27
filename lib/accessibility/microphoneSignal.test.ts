import assert from "node:assert/strict";
import test from "node:test";
import { isMicrophoneSignalAcceptable, MICROPHONE_SIGNAL_THRESHOLD } from "./microphoneSignal";

test("K: a recording where signal was never detected (the real 'click/snap only' Chrome bug) is rejected", () => {
  assert.equal(
    isMicrophoneSignalAcceptable({ signalDetected: false, peakLevel: 0.001, averageLevel: 0.0002 }),
    false,
  );
});

test("a recording with genuine, clearly-detected speech energy is accepted", () => {
  assert.equal(
    isMicrophoneSignalAcceptable({ signalDetected: true, peakLevel: 0.4, averageLevel: 0.08 }),
    true,
  );
});

test("a naturally quiet/slow speaker who still crosses the threshold at least once is accepted, not penalised for a low average level", () => {
  assert.equal(
    isMicrophoneSignalAcceptable({ signalDetected: true, peakLevel: 0.03, averageLevel: 0.005 }),
    true,
  );
});

test("the decision depends only on signalDetected -- peak/average are informational, never separately enforced, so a momentary loud peak with signalDetected already true still passes even with a near-zero average", () => {
  assert.equal(
    isMicrophoneSignalAcceptable({ signalDetected: true, peakLevel: 0.9, averageLevel: 0.0001 }),
    true,
  );
});

test("the threshold constant is exported for the sampler to use, keeping detection and decision logic using the exact same floor", () => {
  assert.equal(MICROPHONE_SIGNAL_THRESHOLD, 0.02);
});
