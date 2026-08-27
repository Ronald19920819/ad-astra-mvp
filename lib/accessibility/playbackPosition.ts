// Pure, DOM-free helpers for LessonAccessibilityAudioPlayer.tsx's
// position-persistence and cross-segment seek math. Kept separate from the
// component so the actual arithmetic/validation is directly unit-testable
// without a browser -- the component itself only wires these to
// localStorage and an <audio> element.

export type PlaybackPosition = {
  // The reading's current approved audio source_hash at the time this
  // position was saved -- see lib/supabase/lessonAccessibilityAudio.ts.
  // Never restored if this no longer matches the live value: a
  // regenerated/re-approved recording must never inherit an old position.
  sourceVersion: string;
  segmentIndex: number;
  // Seconds within that segment -- never a signed URL, never transcript
  // content, never any other server data.
  currentTime: number;
  savedAt: string;
};

const STORAGE_PREFIX = "ad-astra-accessibility-audio";

export function buildPlaybackPositionStorageKey(
  lessonId: string,
  materialId: string,
): string {
  return `${STORAGE_PREFIX}:${lessonId}:${materialId}`;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;
type ClearableStorage = Pick<Storage, "removeItem">;

function isPlaybackPosition(value: unknown): value is PlaybackPosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sourceVersion === "string" &&
    typeof candidate.segmentIndex === "number" &&
    typeof candidate.currentTime === "number" &&
    typeof candidate.savedAt === "string"
  );
}

// localStorage can throw (Safari private browsing, quota exceeded, a
// disabled storage policy) -- persistence failing must never break
// playback itself, so every operation here is a safe no-op on error.
export function readPlaybackPosition(
  storage: ReadableStorage,
  key: string,
): PlaybackPosition | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlaybackPosition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePlaybackPosition(
  storage: WritableStorage,
  key: string,
  position: PlaybackPosition,
): void {
  try {
    storage.setItem(key, JSON.stringify(position));
  } catch {
    // Ignored -- see comment above.
  }
}

export function clearPlaybackPosition(storage: ClearableStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignored -- see comment above.
  }
}

// A saved position may become invalid for reasons other than version
// mismatch: the segment it names no longer exists (should never happen
// for the same version, but defends against corrupt/edited storage), or
// the timestamp is not a real number. Never trusted blindly.
export function resolveRestorablePosition(
  saved: PlaybackPosition | null,
  args: { sourceVersion: string; segmentCount: number },
): { segmentIndex: number; currentTime: number } | null {
  if (!saved) return null;
  if (saved.sourceVersion !== args.sourceVersion) return null;
  if (
    !Number.isInteger(saved.segmentIndex) ||
    saved.segmentIndex < 0 ||
    saved.segmentIndex >= args.segmentCount
  ) {
    return null;
  }
  if (!Number.isFinite(saved.currentTime) || saved.currentTime < 0) return null;

  return { segmentIndex: saved.segmentIndex, currentTime: saved.currentTime };
}

// Cumulative start time of each segment within the whole logical reading.
export function computeSegmentOffsets(durations: number[]): number[] {
  const offsets: number[] = [];
  let cumulative = 0;
  for (const duration of durations) {
    offsets.push(cumulative);
    cumulative += duration;
  }
  return offsets;
}

export function computeLogicalTime(
  segmentOffsets: number[],
  segmentIndex: number,
  withinSegmentTime: number,
): number {
  return (segmentOffsets[segmentIndex] ?? 0) + withinSegmentTime;
}

// Given a target point on the ONE logical timeline (e.g. from dragging the
// seek bar), determines which technical segment that point falls in and
// the offset within it -- the learner never needs to know segments exist.
export function resolveSeekTarget(
  segmentOffsets: number[],
  durations: number[],
  logicalTime: number,
): { segmentIndex: number; withinSegmentTime: number } {
  const clampedTime = Math.max(0, logicalTime);

  for (let index = segmentOffsets.length - 1; index >= 0; index -= 1) {
    if (clampedTime >= segmentOffsets[index]) {
      const rawOffset = clampedTime - segmentOffsets[index];
      const segmentDuration = durations[index];
      const withinSegmentTime =
        typeof segmentDuration === "number" && segmentDuration > 0
          ? Math.min(rawOffset, segmentDuration)
          : rawOffset;
      return { segmentIndex: index, withinSegmentTime };
    }
  }

  return { segmentIndex: 0, withinSegmentTime: 0 };
}

// A saved position that lands within this many seconds of the very end of
// the whole reading is treated as "finished" rather than restored -- there
// is nothing meaningful left to resume.
export const NEAR_END_THRESHOLD_SECONDS = 3;

export function isNearEnd(logicalTime: number, totalDuration: number): boolean {
  return totalDuration > 0 && totalDuration - logicalTime <= NEAR_END_THRESHOLD_SECONDS;
}
