import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlaybackPositionStorageKey,
  clearPlaybackPosition,
  computeLogicalTime,
  computeSegmentOffsets,
  isNearEnd,
  readPlaybackPosition,
  resolveRestorablePosition,
  resolveSeekTarget,
  writePlaybackPosition,
  type PlaybackPosition,
} from "./playbackPosition";

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

test("buildPlaybackPositionStorageKey is namespaced clearly for AD Astra accessibility audio and scoped to lesson+material", () => {
  const key = buildPlaybackPositionStorageKey("lesson-1", "material-1");
  assert.match(key, /^ad-astra-accessibility-audio:/);
  assert.match(key, /lesson-1/);
  assert.match(key, /material-1/);
});

test("write then read round-trips exactly", () => {
  const storage = new FakeStorage();
  const key = buildPlaybackPositionStorageKey("lesson-1", "material-1");
  const position: PlaybackPosition = {
    sourceVersion: "hash-abc",
    segmentIndex: 3,
    currentTime: 12.5,
    savedAt: "2026-08-28T00:00:00.000Z",
  };
  writePlaybackPosition(storage, key, position);
  assert.deepEqual(readPlaybackPosition(storage, key), position);
});

test("A: writing a position persists it for later reads (proves persistence works at all)", () => {
  const storage = new FakeStorage();
  const key = buildPlaybackPositionStorageKey("lesson-1", "material-1");
  assert.equal(readPlaybackPosition(storage, key), null);
  writePlaybackPosition(storage, key, {
    sourceVersion: "v1",
    segmentIndex: 0,
    currentTime: 5,
    savedAt: "2026-08-28T00:00:00.000Z",
  });
  assert.ok(readPlaybackPosition(storage, key));
});

test("reading malformed/corrupt JSON never throws -- it resolves to null", () => {
  const storage = new FakeStorage();
  const key = "some-key";
  storage.setItem(key, "{not valid json");
  assert.equal(readPlaybackPosition(storage, key), null);
});

test("reading a value missing required fields resolves to null rather than a half-populated position", () => {
  const storage = new FakeStorage();
  const key = "some-key";
  storage.setItem(key, JSON.stringify({ sourceVersion: "v1" }));
  assert.equal(readPlaybackPosition(storage, key), null);
});

test("clearPlaybackPosition removes the stored entry (E: Restart clears the saved position)", () => {
  const storage = new FakeStorage();
  const key = buildPlaybackPositionStorageKey("lesson-1", "material-1");
  writePlaybackPosition(storage, key, {
    sourceVersion: "v1",
    segmentIndex: 2,
    currentTime: 3,
    savedAt: "2026-08-28T00:00:00.000Z",
  });
  clearPlaybackPosition(storage, key);
  assert.equal(readPlaybackPosition(storage, key), null);
});

test("B/reopen: a matching saved position resolves to the exact segment and time it was saved at", () => {
  const saved: PlaybackPosition = {
    sourceVersion: "hash-abc",
    segmentIndex: 4,
    currentTime: 18.2,
    savedAt: "2026-08-28T00:00:00.000Z",
  };
  const restorable = resolveRestorablePosition(saved, { sourceVersion: "hash-abc", segmentCount: 8 });
  assert.deepEqual(restorable, { segmentIndex: 4, currentTime: 18.2 });
});

test("P: a saved position for an OLD audio version is ignored -- a regenerated/re-approved recording never inherits a stale position", () => {
  const saved: PlaybackPosition = {
    sourceVersion: "old-hash",
    segmentIndex: 4,
    currentTime: 18.2,
    savedAt: "2026-08-28T00:00:00.000Z",
  };
  const restorable = resolveRestorablePosition(saved, { sourceVersion: "new-hash", segmentCount: 8 });
  assert.equal(restorable, null);
});

test("a saved segment index that is out of range for the current segment count is never restored", () => {
  const saved: PlaybackPosition = {
    sourceVersion: "hash-abc",
    segmentIndex: 10,
    currentTime: 5,
    savedAt: "2026-08-28T00:00:00.000Z",
  };
  assert.equal(resolveRestorablePosition(saved, { sourceVersion: "hash-abc", segmentCount: 8 }), null);
  assert.equal(
    resolveRestorablePosition({ ...saved, segmentIndex: -1 }, { sourceVersion: "hash-abc", segmentCount: 8 }),
    null,
  );
});

test("a negative or non-finite saved currentTime is never restored", () => {
  const base: PlaybackPosition = {
    sourceVersion: "hash-abc",
    segmentIndex: 0,
    currentTime: -5,
    savedAt: "2026-08-28T00:00:00.000Z",
  };
  assert.equal(resolveRestorablePosition(base, { sourceVersion: "hash-abc", segmentCount: 8 }), null);
  assert.equal(
    resolveRestorablePosition({ ...base, currentTime: Number.NaN }, { sourceVersion: "hash-abc", segmentCount: 8 }),
    null,
  );
});

test("no saved position at all resolves to null cleanly", () => {
  assert.equal(resolveRestorablePosition(null, { sourceVersion: "v1", segmentCount: 8 }), null);
});

test("K: cumulative segment offsets and total duration are computed from real per-segment durations", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50]; // the real 8-segment shape
  const offsets = computeSegmentOffsets(durations);
  assert.deepEqual(offsets, [0, 30, 75, 95, 155, 180, 220, 255]);
  const total = durations.reduce((a, b) => a + b, 0);
  assert.equal(total, 305);
});

test("computeLogicalTime combines a segment's cumulative offset with progress inside it", () => {
  const offsets = computeSegmentOffsets([30, 45, 20, 60, 25, 40, 35, 50]);
  assert.equal(computeLogicalTime(offsets, 0, 10), 10);
  assert.equal(computeLogicalTime(offsets, 3, 5), 95 + 5);
  assert.equal(computeLogicalTime(offsets, 7, 0), 255);
});

test("F: seeking forward within the current segment resolves to the same segment with the new offset", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50];
  const offsets = computeSegmentOffsets(durations);
  // Currently 10s into segment 0 (offset 0); seek to logical time 20 -- still segment 0.
  const target = resolveSeekTarget(offsets, durations, 20);
  assert.deepEqual(target, { segmentIndex: 0, withinSegmentTime: 20 });
});

test("G: seeking backward within the current segment resolves correctly", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50];
  const offsets = computeSegmentOffsets(durations);
  // Somewhere in segment 3 (offset 95..155); seek back to logical time 100.
  const target = resolveSeekTarget(offsets, durations, 100);
  assert.deepEqual(target, { segmentIndex: 3, withinSegmentTime: 5 });
});

test("H: seeking across a segment boundary (forward and backward) lands in the correct target segment", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50];
  const offsets = computeSegmentOffsets(durations);

  // ~70% into a 305s total (matches the task's own worked example) lands
  // partway through segment 5 (offset 180..220).
  const total = durations.reduce((a, b) => a + b, 0);
  const seventyPercent = total * 0.7;
  const forwardTarget = resolveSeekTarget(offsets, durations, seventyPercent);
  assert.equal(forwardTarget.segmentIndex, 5);
  assert.ok(forwardTarget.withinSegmentTime >= 0 && forwardTarget.withinSegmentTime <= durations[5]);

  // From near the end, seek backward into segment 1.
  const backwardTarget = resolveSeekTarget(offsets, durations, 40);
  assert.deepEqual(backwardTarget, { segmentIndex: 1, withinSegmentTime: 10 });
});

test("seeking near the very beginning resolves to segment 0 near time 0", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50];
  const offsets = computeSegmentOffsets(durations);
  assert.deepEqual(resolveSeekTarget(offsets, durations, 0), { segmentIndex: 0, withinSegmentTime: 0 });
  assert.deepEqual(resolveSeekTarget(offsets, durations, 2), { segmentIndex: 0, withinSegmentTime: 2 });
});

test("seeking near the very end resolves into the final segment, clamped to its own duration", () => {
  const durations = [30, 45, 20, 60, 25, 40, 35, 50];
  const offsets = computeSegmentOffsets(durations);
  const total = durations.reduce((a, b) => a + b, 0);
  const target = resolveSeekTarget(offsets, durations, total - 1);
  assert.equal(target.segmentIndex, 7);
  const overshoot = resolveSeekTarget(offsets, durations, total + 1000);
  assert.equal(overshoot.segmentIndex, 7);
  assert.equal(overshoot.withinSegmentTime, durations[7]);
});

test("seeking before the beginning clamps to time 0 rather than going negative", () => {
  const durations = [30, 45];
  const offsets = computeSegmentOffsets(durations);
  assert.deepEqual(resolveSeekTarget(offsets, durations, -50), { segmentIndex: 0, withinSegmentTime: 0 });
});

test("isNearEnd flags only genuinely near-finished positions", () => {
  assert.equal(isNearEnd(298, 300), true);
  assert.equal(isNearEnd(100, 300), false);
  assert.equal(isNearEnd(50, 0), false, "an unknown (zero) total duration is never treated as near-end");
});
