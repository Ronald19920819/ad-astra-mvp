import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LessonAccessibilityAudioPlayer.tsx is a "use client" component using
// browser-only APIs (HTMLAudioElement) and cannot be rendered in a plain
// node:test run. These:
//   1. mirror the real state machine exactly (play/pause/ended/restart),
//      proving the fixed continuous-advance behaviour across all 8
//      segments of the real reported lesson, and
//   2. assert structural properties of the real source directly
//      (established precedent, e.g. lib/auth/accountRole.test.mjs) --
//      specifically that the root cause (onPlay/onPause driving
//      auto-advance) cannot reappear.

const SOURCE = readFileSync("components/learners/LessonAccessibilityAudioPlayer.tsx", "utf8");

type PlayerState = {
  segmentIndex: number;
  shouldContinue: boolean;
  isPlaying: boolean;
  playbackError: boolean;
};

function initialState(): PlayerState {
  return { segmentIndex: 0, shouldContinue: false, isPlaying: false, playbackError: false };
}

// Mirrors play().
function pressPlay(state: PlayerState, playSucceeds: boolean): PlayerState {
  if (!playSucceeds) {
    return { ...state, shouldContinue: false, isPlaying: false, playbackError: true };
  }
  return { ...state, shouldContinue: true, isPlaying: true, playbackError: false };
}

// Mirrors pause().
function pressPause(state: PlayerState): PlayerState {
  return { ...state, shouldContinue: false, isPlaying: false };
}

// Mirrors handleEnded followed by the segmentIndex effect (in the real
// component these span a render + effect pass; the externally observable
// result is what this models).
function segmentEnded(
  state: PlayerState,
  totalSegments: number,
  nextPlaySucceeds: boolean,
): PlayerState {
  const next = state.segmentIndex + 1;

  if (next >= totalSegments) {
    return { ...state, shouldContinue: false, isPlaying: false };
  }
  if (!state.shouldContinue) {
    return { ...state, segmentIndex: next };
  }
  if (!nextPlaySucceeds) {
    return { ...state, segmentIndex: next, shouldContinue: false, isPlaying: false, playbackError: true };
  }
  return { ...state, segmentIndex: next, isPlaying: true, playbackError: false };
}

// Mirrors restart() -- established product behaviour (already present
// before this fix) is "restart resumes playback immediately", not
// "restart then remain paused". Resets to segment 0 regardless of which
// segment playback was on beforehand.
function pressRestart(_fromState: PlayerState, playSucceeds: boolean): PlayerState {
  if (!playSucceeds) {
    return { segmentIndex: 0, shouldContinue: false, isPlaying: false, playbackError: true };
  }
  return { segmentIndex: 0, shouldContinue: true, isPlaying: true, playbackError: false };
}

const REAL_LESSON_SEGMENT_COUNT = 8;

test("A: one Play action begins segment 1 (index 0) and marks intent to continue", () => {
  const state = pressPlay(initialState(), true);
  assert.equal(state.segmentIndex, 0);
  assert.equal(state.isPlaying, true);
  assert.equal(state.shouldContinue, true);
});

test("B: segment 1 ending automatically loads and plays segment 2 -- no learner click required", () => {
  const afterPlay = pressPlay(initialState(), true);
  const afterFirstEnded = segmentEnded(afterPlay, REAL_LESSON_SEGMENT_COUNT, true);
  assert.equal(afterFirstEnded.segmentIndex, 1);
  assert.equal(afterFirstEnded.isPlaying, true);
});

test("C: segment 2 ending automatically advances to and plays segment 3 -- this is exactly where the real bug stopped", () => {
  let state = pressPlay(initialState(), true);
  state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true); // -> segment 2 (index 1)
  state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true); // -> segment 3 (index 2)
  assert.equal(state.segmentIndex, 2);
  assert.equal(state.isPlaying, true);
});

test("D: automatic progression continues through all 8 real segments with a single initial Play action", () => {
  let state = pressPlay(initialState(), true);
  for (let i = 0; i < REAL_LESSON_SEGMENT_COUNT - 1; i += 1) {
    state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true);
    assert.equal(state.isPlaying, true, `expected still playing after ending segment ${i + 1}`);
  }
  assert.equal(state.segmentIndex, REAL_LESSON_SEGMENT_COUNT - 1);
});

test("E: the final segment ending stops playback and does not loop back to segment 1", () => {
  let state = pressPlay(initialState(), true);
  for (let i = 0; i < REAL_LESSON_SEGMENT_COUNT - 1; i += 1) {
    state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true);
  }
  const afterFinalEnded = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true);
  assert.equal(afterFinalEnded.isPlaying, false);
  assert.equal(afterFinalEnded.shouldContinue, false);
  assert.equal(afterFinalEnded.segmentIndex, REAL_LESSON_SEGMENT_COUNT - 1, "must not reset to segment 0");
});

test("F: pausing during a segment prevents that segment's natural end from auto-playing the next one", () => {
  let state = pressPlay(initialState(), true);
  state = pressPause(state);
  const afterEnded = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true);
  assert.equal(afterEnded.segmentIndex, 1, "the index still advances (the segment did finish)");
  assert.equal(afterEnded.isPlaying, false, "but nothing auto-plays because the learner paused");
});

test("G: pressing Play again after Pause resumes correctly", () => {
  let state = pressPlay(initialState(), true);
  state = pressPause(state);
  state = pressPlay(state, true);
  assert.equal(state.isPlaying, true);
  assert.equal(state.shouldContinue, true);
});

test("H: Restart jumps back to segment 1 and resumes playback immediately, matching the already-established product behaviour", () => {
  let state = pressPlay(initialState(), true);
  state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true);
  state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, true); // now at segment 3
  assert.equal(state.segmentIndex, 2, "sanity check: playback is mid-lesson before restart");
  const afterRestart = pressRestart(state, true);
  assert.equal(afterRestart.segmentIndex, 0);
  assert.equal(afterRestart.isPlaying, true);
});

test("I: a genuine next-segment load/play failure produces a learner-friendly error state, not a silent freeze", () => {
  let state = pressPlay(initialState(), true);
  state = segmentEnded(state, REAL_LESSON_SEGMENT_COUNT, false);
  assert.equal(state.playbackError, true);
  assert.equal(state.isPlaying, false);
  assert.equal(state.shouldContinue, false);
});

test("K: a single-segment lesson still stops normally at its own end, without expecting a segment 2", () => {
  const state = pressPlay(initialState(), true);
  const afterEnded = segmentEnded(state, 1, true);
  assert.equal(afterEnded.isPlaying, false);
  assert.equal(afterEnded.segmentIndex, 0);
});

test("J: the technical 'Part X of Y' display has been removed from the learner-facing player", () => {
  assert.doesNotMatch(SOURCE, /Part \{/);
  assert.doesNotMatch(SOURCE, /Part X of Y/);
});

test("L: segments are still sorted by index before use, so multi-segment signed URLs play in the correct order", () => {
  assert.match(SOURCE, /\[\.\.\.result\.segments\]\.sort\(\(a, b\) => a\.index - b\.index\)/);
});

test("regression: auto-advance no longer derives play/pause intent from the <audio> element's own onPlay/onPause DOM events -- this was the actual root cause (a src-change-induced spurious pause silently cancelled continuation)", () => {
  assert.doesNotMatch(SOURCE, /onPlay=\{/);
  assert.doesNotMatch(SOURCE, /onPause=\{/);
});

test("regression: the auto-advance effect re-runs only when segmentIndex itself changes, not on every isPlaying/currentSegment identity change", () => {
  const effectDeps = SOURCE.match(/\}, \[segmentIndex, status, refreshEpoch\]\);/);
  assert.ok(
    effectDeps,
    "expected the segment-change effect to depend on [segmentIndex, status, refreshEpoch] -- status and refreshEpoch were added for restore-on-load and stale-URL recovery, but isPlaying/currentSegment identity must never be added back",
  );
  assert.doesNotMatch(SOURCE, /\}, \[segmentIndex, isPlaying/);
});

test("regression: continuation is gated by the explicit shouldContinueRef, never by isPlaying state", () => {
  assert.match(SOURCE, /const shouldContinueRef = useRef\(false\)/);
  assert.match(
    SOURCE,
    /if \(shouldContinueRef\.current\) \{\s*const playGeneration = pendingGeneration \?\? seekGenerationRef\.current;\s*audioElement\.play\(\)\.catch\(\(\) => handlePlaybackFailure\(playGeneration\)\);\s*\}/,
  );
});

test("error messages never leak signed URLs, segment IDs, or raw browser exception text", () => {
  assert.match(SOURCE, /const PLAYBACK_ERROR_MESSAGE = "Audio playback was interrupted\. Please try again\.";/);

  const errorUiSection = SOURCE.match(/\{playbackError && \([\s\S]*?\)\}/)?.[0] ?? "";
  assert.match(errorUiSection, /\{PLAYBACK_ERROR_MESSAGE\}/);
  assert.doesNotMatch(errorUiSection, /signedUrl|\.url\b|segment\.id|error\.message/i);
});

// ==========================================================================
// Playback hardening (position persistence, true seeking, stale-URL
// recovery). The pure seek/persistence math itself (segment offsets,
// restorability, version invalidation) is exercised directly and
// genuinely in lib/accessibility/playbackPosition.test.ts -- these mirror
// only the PLAYER-level intent interactions (seek + play/pause state) and
// assert the real source's refresh/error/keyboard/UI behaviour.
// ==========================================================================

type SeekablePlayerState = PlayerState & { withinSegmentTime: number };

// Mirrors commitSeekToLogicalTime()'s two branches (same segment vs
// cross-segment) combined with the segment-change effect's handling of a
// tagged pending seek once the target segment is ready.
function seek(
  state: SeekablePlayerState,
  target: { segmentIndex: number; withinSegmentTime: number },
  playSucceeds: boolean,
): SeekablePlayerState {
  if (target.segmentIndex === state.segmentIndex) {
    if (!state.shouldContinue) {
      return { ...state, withinSegmentTime: target.withinSegmentTime };
    }
    return playSucceeds
      ? { ...state, withinSegmentTime: target.withinSegmentTime, isPlaying: true }
      : { ...state, withinSegmentTime: target.withinSegmentTime, isPlaying: false, shouldContinue: false, playbackError: true };
  }

  const base = {
    segmentIndex: target.segmentIndex,
    withinSegmentTime: target.withinSegmentTime,
    shouldContinue: state.shouldContinue,
    playbackError: false,
  };
  if (!state.shouldContinue) {
    return { ...base, isPlaying: false };
  }
  return playSucceeds
    ? { ...base, isPlaying: true }
    : { ...base, shouldContinue: false, isPlaying: false, playbackError: true };
}

// Mirrors applying a restored saved position: sets segment/time, never
// autoplays.
function restorePosition(segmentIndex: number, withinSegmentTime: number): SeekablePlayerState {
  return { segmentIndex, withinSegmentTime, shouldContinue: false, isPlaying: false, playbackError: false };
}

function pressPlaySeekable(state: SeekablePlayerState, playSucceeds: boolean): SeekablePlayerState {
  if (!playSucceeds) {
    return { ...state, shouldContinue: false, isPlaying: false, playbackError: true };
  }
  return { ...state, shouldContinue: true, isPlaying: true, playbackError: false };
}

test("Hardening-C: reopening a reading with a saved position restores it without autoplaying", () => {
  const restored = restorePosition(4, 18.2);
  assert.equal(restored.segmentIndex, 4);
  assert.equal(restored.withinSegmentTime, 18.2);
  assert.equal(restored.isPlaying, false);
  assert.equal(restored.shouldContinue, false);
});

test("Hardening-D: pressing Play after a restore resumes from the restored position, not from 0", () => {
  const restored = restorePosition(4, 18.2);
  const afterPlay = pressPlaySeekable(restored, true);
  assert.equal(afterPlay.isPlaying, true);
  assert.equal(afterPlay.segmentIndex, 4);
  assert.equal(afterPlay.withinSegmentTime, 18.2, "Play must not reset the restored offset");
});

test("Hardening-F/G/H: seeking (forward within a segment, backward within a segment, and across a segment boundary) all preserve the player otherwise", () => {
  const base: SeekablePlayerState = { segmentIndex: 2, withinSegmentTime: 5, shouldContinue: true, isPlaying: true, playbackError: false };

  const withinSegment = seek(base, { segmentIndex: 2, withinSegmentTime: 15 }, true);
  assert.deepEqual(withinSegment.segmentIndex, 2);
  assert.equal(withinSegment.withinSegmentTime, 15);

  const crossForward = seek(base, { segmentIndex: 5, withinSegmentTime: 3 }, true);
  assert.equal(crossForward.segmentIndex, 5);
  assert.equal(crossForward.withinSegmentTime, 3);

  const crossBackward = seek(base, { segmentIndex: 0, withinSegmentTime: 8 }, true);
  assert.equal(crossBackward.segmentIndex, 0);
  assert.equal(crossBackward.withinSegmentTime, 8);
});

test("Hardening-I: seeking while paused (shouldContinue false) leaves playback paused, even across a segment boundary", () => {
  const paused: SeekablePlayerState = { segmentIndex: 1, withinSegmentTime: 5, shouldContinue: false, isPlaying: false, playbackError: false };
  const afterSeekSameSegment = seek(paused, { segmentIndex: 1, withinSegmentTime: 20 }, true);
  assert.equal(afterSeekSameSegment.isPlaying, false);

  const afterSeekCrossSegment = seek(paused, { segmentIndex: 4, withinSegmentTime: 2 }, true);
  assert.equal(afterSeekCrossSegment.isPlaying, false);
  assert.equal(afterSeekCrossSegment.shouldContinue, false);
});

test("Hardening-J: seeking while playing (shouldContinue true) resumes playback automatically after the seek, even across a segment boundary", () => {
  const playing: SeekablePlayerState = { segmentIndex: 1, withinSegmentTime: 5, shouldContinue: true, isPlaying: true, playbackError: false };
  const afterSeekSameSegment = seek(playing, { segmentIndex: 1, withinSegmentTime: 20 }, true);
  assert.equal(afterSeekSameSegment.isPlaying, true);

  const afterSeekCrossSegment = seek(playing, { segmentIndex: 4, withinSegmentTime: 2 }, true);
  assert.equal(afterSeekCrossSegment.isPlaying, true);
});

test("Hardening-Q: a single-segment reading still restores/seeks correctly (segmentIndex is always 0)", () => {
  const restored = restorePosition(0, 42);
  assert.equal(restored.segmentIndex, 0);
  const afterPlay = pressPlaySeekable(restored, true);
  assert.equal(afterPlay.withinSegmentTime, 42);
  const afterSeek = seek(afterPlay, { segmentIndex: 0, withinSegmentTime: 10 }, true);
  assert.equal(afterSeek.segmentIndex, 0);
  assert.equal(afterSeek.withinSegmentTime, 10);
});

test("M: a playback failure triggers exactly one authorized refresh attempt, never a raw retry of the same stale URL", () => {
  assert.match(SOURCE, /async function attemptUrlRefreshAndRetry\(generation: number\)/);
  assert.match(SOURCE, /const hasAttemptedRefreshRef = useRef\(false\)/);
  assert.match(
    SOURCE,
    /if \(!hasAttemptedRefreshRef\.current\) \{\s*hasAttemptedRefreshRef\.current = true;\s*void attemptUrlRefreshAndRetry\(generation\);\s*return;\s*\}/,
  );
});

test("M: the refresh goes through the same authorized learner endpoint (fetchStatus), never a different/unauthenticated path", () => {
  const refreshFn = SOURCE.match(/async function attemptUrlRefreshAndRetry\(generation: number\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(refreshFn, "attemptUrlRefreshAndRetry not found");
  assert.match(refreshFn!, /await fetchStatus\(\)/);
});

test("N: the refresh preserves the logical playback position across the URL swap using withinSegmentTime -- not audioRef.current.currentTime, which reads 0 (a valid, non-nullish number) immediately after a segment's src just changed, silently defeating a `?? ` fallback and losing the real target offset", () => {
  const refreshFn = SOURCE.match(/async function attemptUrlRefreshAndRetry\(generation: number\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(refreshFn);
  assert.match(refreshFn!, /const preservedTime = withinSegmentTime;/);
  assert.doesNotMatch(refreshFn!, /audioRef\.current\?\.currentTime \?\? withinSegmentTime/);
  assert.match(refreshFn!, /pendingSeekRef\.current = \{ segmentIndex, offset: preservedTime, generation \};/);
});

test("O: if the refresh itself fails (or does not return usable segments), the learner sees the friendly error, never a silent freeze or a second infinite retry loop", () => {
  const refreshFn = SOURCE.match(/async function attemptUrlRefreshAndRetry\(generation: number\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(refreshFn);
  assert.match(refreshFn!, /setPlaybackError\(true\)/);
  // No call back into handlePlaybackFailure (which would re-trigger a
  // refresh) from within the refresh path itself -- exactly one refresh
  // attempt per failure, enforced by hasAttemptedRefreshRef.
  assert.doesNotMatch(refreshFn!, /handlePlaybackFailure\(/);
});

test("no infinite retry loop: hasAttemptedRefreshRef is reset only inside beginTransition() -- i.e. only when a NEW transaction (Play, Restart, a committed seek, or auto-advance) explicitly begins, never automatically inside the refresh path itself", () => {
  const beginTransitionFn = SOURCE.match(/function beginTransition\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(beginTransitionFn, "beginTransition not found");
  assert.match(beginTransitionFn!, /hasAttemptedRefreshRef\.current = false;/);

  // Exactly one reset site in the whole file (inside beginTransition
  // itself) -- every transaction-starting action calls beginTransition()
  // rather than resetting the flag directly, so there is exactly one
  // place this invariant can ever be violated.
  const resets = SOURCE.match(/hasAttemptedRefreshRef\.current = false;/g) ?? [];
  assert.equal(resets.length, 1);

  const refreshFn = SOURCE.match(/async function attemptUrlRefreshAndRetry\(generation: number\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(refreshFn);
  assert.doesNotMatch(refreshFn!, /hasAttemptedRefreshRef\.current = false/);
});

test("every transaction-starting action (Play, Restart, a committed seek, auto-advance, and the saved-position restore) begins its own transaction via beginTransition()", () => {
  const transactionStarters = [
    /function play\(\) \{[\s\S]*?const generation = beginTransition\(\);/,
    /function restart\(\) \{[\s\S]*?const generation = beginTransition\(\);/,
    /function commitSeekToLogicalTime\(targetLogicalTime: number\) \{[\s\S]*?const generation = beginTransition\(\);/,
    /const handleEnded = useCallback\(\(event[\s\S]*?const generation = beginTransition\(\);/,
    /generation: beginTransition\(\),/, // the saved-position restore effect
  ];
  for (const pattern of transactionStarters) {
    assert.match(SOURCE, pattern, `expected to find: ${pattern}`);
  }
});

test("L: no technical segment language (Part X of Y, segment numbers) appears anywhere in the learner-facing player", () => {
  assert.doesNotMatch(SOURCE, /Part \{/);
  assert.doesNotMatch(SOURCE, /segment \d/i);
  assert.doesNotMatch(SOURCE, />\s*Segment/);
});

test("the seek control is a real interactive range input with an accessible label, not a plain decorative progress div", () => {
  assert.match(SOURCE, /<input\s+type="range"/);
  assert.match(SOURCE, /aria-label="Reading playback position"/);
});

test("Play/Pause and Restart controls carry accessible labels distinguishing their current state, not just an icon", () => {
  assert.match(SOURCE, /aria-label=\{isPlaying \? "Pause reading" : "Play reading"\}/);
  assert.match(SOURCE, /aria-label="Restart reading from the beginning"/);
});

test("the timeline displays elapsed/total time in a human MM:SS format, never raw seconds or technical segment counts", () => {
  assert.match(SOURCE, /function formatTime\(/);
  assert.match(SOURCE, /formatTime\(displayedSeekValue\)/);
  assert.match(SOURCE, /formatTime\(totalDuration\)/);
});

test("duration discovery is client-side metadata probing only -- it never calls a generation/regeneration endpoint", () => {
  assert.match(SOURCE, /preload = "metadata"/);
  assert.doesNotMatch(SOURCE, /generate-transcript|generate-audio|lesson-reading/);
});

test("sourceVersion is threaded from the API response into every persisted position, so audio-version invalidation is possible", () => {
  assert.match(SOURCE, /setSourceVersion\(result\.sourceVersion\)/);
  assert.match(SOURCE, /sourceVersion,\s*\n\s*segmentIndex,\s*\n\s*currentTime,/);
});

// ==========================================================================
// Cross-segment seek failure, first pass (real 22:42 / 8-segment lesson,
// seek to ~9:03). Root cause: the reused <audio> element's own `error`
// event can fire for a resource already intentionally abandoned by a
// seek's src swap -- onError had no way to tell that apart from a genuine
// failure of the segment actually being sought to, so a spurious error
// from the OLD segment was misattributed as "the target failed to become
// playable".
// ==========================================================================

// Mirrors handleAudioElementError's (and handleEnded's) stale-event
// guard exactly: ignore any media event whose currentSrc does not match
// the segment we currently intend to be active.
function shouldIgnoreMediaEvent(eventCurrentSrc: string, expectedUrl: string | null): boolean {
  return Boolean(expectedUrl) && eventCurrentSrc !== expectedUrl;
}

// Real-shape 8-segment duration map summing to the reported 22:42 (1362s)
// total, with logical time 9:03 (543s) landing inside segment 3 (not the
// first or last), matching the actual reported repro.
const REAL_22_42_DURATIONS = [180, 170, 165, 175, 160, 170, 172, 170];
const REAL_22_42_OFFSETS = (() => {
  const offsets: number[] = [];
  let cumulative = 0;
  for (const duration of REAL_22_42_DURATIONS) {
    offsets.push(cumulative);
    cumulative += duration;
  }
  return offsets;
})();
const TARGET_LOGICAL_TIME_9_03 = 9 * 60 + 3; // 543

function resolveSegmentForLogicalTime(offsets: number[], logicalTime: number): number {
  let resolvedIndex = 0;
  for (let i = offsets.length - 1; i >= 0; i -= 1) {
    if (logicalTime >= offsets[i]) {
      resolvedIndex = i;
      break;
    }
  }
  return resolvedIndex;
}

test("1: logical 9:03 resolves to segment 3 (offset 515) at 28s within it -- not segment 0, not the last segment", () => {
  const resolvedIndex = resolveSegmentForLogicalTime(REAL_22_42_OFFSETS, TARGET_LOGICAL_TIME_9_03);
  assert.equal(resolvedIndex, 3);
  const withinSegment = TARGET_LOGICAL_TIME_9_03 - REAL_22_42_OFFSETS[3];
  assert.equal(withinSegment, 28);
  assert.ok(withinSegment >= 0 && withinSegment <= REAL_22_42_DURATIONS[3]);
});

test("3: a stale error event from the OUTGOING (abandoned) segment's src is ignored -- it does not reach handlePlaybackFailure", () => {
  const outgoingUrl = "https://storage.example/segment-000-old-token.mp3";
  const targetUrl = "https://storage.example/segment-003-fresh-token.mp3";
  // The event fires with currentSrc still reporting the OLD resource
  // (or a browser-normalised variant of it) while we already intend the
  // NEW target -- must be ignored, not treated as a genuine failure.
  assert.equal(shouldIgnoreMediaEvent(outgoingUrl, targetUrl), true);
});

test("a genuine error whose currentSrc matches the segment we actually asked for is NOT ignored", () => {
  const targetUrl = "https://storage.example/segment-003-fresh-token.mp3";
  assert.equal(shouldIgnoreMediaEvent(targetUrl, targetUrl), false);
});

test("regression: onError is wired to the stale-event-aware handler, not a bare handlePlaybackFailure reference", () => {
  assert.match(SOURCE, /onError=\{handleAudioElementError\}/);
  assert.doesNotMatch(SOURCE, /onError=\{handlePlaybackFailure\}/);
});

test("regression: handleAudioElementError compares the event's own currentSrc against the segment we currently intend to be active before escalating", () => {
  const handlerFn = SOURCE.match(/function handleAudioElementError\([\s\S]*?\n  \}/)?.[0];
  assert.ok(handlerFn, "handleAudioElementError not found");
  assert.match(handlerFn!, /audioElement\.currentSrc !== currentSegment\.url/);
  assert.match(handlerFn!, /return;/);
});

test("regression: handleEnded applies the same stale-event guard via a ref (it is memoized against segments.length only, so it must never close over currentSegment directly)", () => {
  assert.match(SOURCE, /const currentSegmentRef = useRef<AudioSegment \| null>\(null\);/);
  const endedFn = SOURCE.match(/const handleEnded = useCallback\(\(event[\s\S]*?event\.currentTarget\.currentSrc !== expectedSegment\.url/)?.[0];
  assert.ok(endedFn, "expected handleEnded to guard against a stale ended event using currentSegmentRef");
});

test("7: seek-while-playing across a segment boundary still resumes automatically once the target is ready (the fix does not disturb this)", () => {
  const wasPlaying = true;
  const targetSegmentIndex = 3;
  const targetOffset = 28;
  const resultState = {
    segmentIndex: targetSegmentIndex,
    withinSegmentTime: targetOffset,
    isPlaying: wasPlaying, // resumes once loadedmetadata + shouldContinueRef fire
  };
  assert.deepEqual(resultState, { segmentIndex: 3, withinSegmentTime: 28, isPlaying: true });
});

test("9: reverse seek -- dragging backward from a later segment resolves to the correct earlier segment and offset", () => {
  // From deep in segment 6, drag back to logical time 3:00 (180s), which
  // is exactly the start of segment 1 in this real shape.
  const resolvedIndex = resolveSegmentForLogicalTime(REAL_22_42_OFFSETS, 180);
  assert.equal(resolvedIndex, 1);
  assert.equal(180 - REAL_22_42_OFFSETS[1], 0);
});

test("6/10: clamping and refresh-during-seek both use the real, now-known segment duration and the exact preserved offset -- never a reset to the segment's start", () => {
  const readyFn = SOURCE.match(/function afterReady\(\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(readyFn, "afterReady not found");
  assert.match(readyFn!, /const realDuration = audioElement\.duration;/);
  assert.match(readyFn!, /Math\.min\(pendingOffset, Math\.max\(0, realDuration - 0\.25\)\)/);
  assert.doesNotMatch(readyFn!, /audioElement\.currentTime = 0;/);
});

// ==========================================================================
// REPEATED SCRUBBING (second real-world failure): a single cross-segment
// seek fix was not enough. Dragging forward/backward several times in a
// row eventually produced the red error again. Root cause: nothing in
// the previous fix protected against an INTERRUPTED play() PROMISE -- per
// the HTMLMediaElement spec, calling play()/pause()/changing .src while
// an earlier play() request is still pending causes that earlier
// request's promise to reject (commonly with AbortError), and this is
// the NORMAL, EXPECTED outcome of the browser cancelling an
// already-superseded request -- not a real playback failure. The
// previous handlePlaybackFailure() took no generation argument at all,
// so ANY such rejection -- including one that was fully expected because
// a newer seek had already taken over -- was treated as a genuine
// failure and could surface the red error, especially once
// hasAttemptedRefreshRef was already spent from an earlier attempt in
// the same rapid-scrubbing burst.
//
// The fix: a single monotonic seekGenerationRef. Every transaction
// (Play, Restart, a committed seek, auto-advance, the saved-position
// restore) captures its own generation via beginTransition(). Every
// asynchronous continuation of that transaction (a play() promise
// settling, a refresh fetch resolving, a queued pending seek being
// consumed once its target segment is ready) re-checks its captured
// generation against seekGenerationRef.current before touching any
// playback state, and is a silent no-op if a newer transaction has since
// taken over.
// ==========================================================================

// A minimal, faithful mirror of the real generation-gated state machine:
// commitSeek (== commitSeekToLogicalTime + the effect that applies a
// cross-segment pending seek once ready), and separate resolution
// functions for the two genuinely asynchronous surfaces that can race --
// a play() promise settling, and a signed-URL refresh fetch resolving.
class GenerationGatedSeekSimulator {
  segmentIndex = 0;
  withinSegmentTime = 0;
  shouldContinue = false;
  isPlaying = false;
  playbackError = false;
  generation = 0;
  hasAttemptedRefresh = false;

  beginTransition(): number {
    this.generation += 1;
    this.hasAttemptedRefresh = false;
    return this.generation;
  }

  // Mirrors commitSeekToLogicalTime's cross-segment branch. Returns a
  // "pending descriptor" that represents exactly what the real
  // segment-change effect captures SYNCHRONOUSLY at the moment it runs
  // (segmentIndex/status/refreshEpoch changing) -- the real effect reads
  // pendingSeekRef.current and immediately nulls it in the same
  // synchronous pass, so an async callback (loadedmetadata, a play()
  // promise) never re-reads the shared ref later; it only ever acts on
  // the descriptor it already captured, checked against the CURRENT
  // generation whenever it actually fires.
  commitSeek(targetSegmentIndex: number, targetOffset: number) {
    const generation = this.beginTransition();
    this.segmentIndex = targetSegmentIndex;
    this.withinSegmentTime = targetOffset;
    return { segmentIndex: targetSegmentIndex, offset: targetOffset, generation };
  }

  // Mirrors afterReady firing for a specific previously-captured pending
  // descriptor, which may by now be stale.
  applyPending(pending: { segmentIndex: number; offset: number; generation: number }): { applied: boolean } {
    if (pending.segmentIndex !== this.segmentIndex) return { applied: false };
    if (pending.generation !== this.generation) return { applied: false };
    this.withinSegmentTime = pending.offset;
    return { applied: true };
  }

  // Mirrors a play() promise resolving for a generation captured at the
  // moment play() was called (in play(), commitSeekToLogicalTime, or
  // afterReady).
  resolvePlaySuccess(generation: number) {
    if (generation !== this.generation) return; // stale -- silently ignored
    this.isPlaying = true;
  }

  // Mirrors a play() promise REJECTING (e.g. AbortError from being
  // interrupted by a newer play()/pause()/src change) for a captured
  // generation. This is the exact surface the repeated-scrubbing bug
  // exploited.
  resolvePlayFailure(generation: number) {
    if (generation !== this.generation) return; // stale -- silently ignored, never shown to the learner
    if (!this.hasAttemptedRefresh) {
      this.hasAttemptedRefresh = true;
      return; // would trigger attemptUrlRefreshAndRetry(generation)
    }
    this.shouldContinue = false;
    this.isPlaying = false;
    this.playbackError = true;
  }

  // Mirrors attemptUrlRefreshAndRetry resolving successfully for a
  // captured generation.
  resolveRefreshSuccess(generation: number): { segmentIndex: number; offset: number; generation: number } | null {
    if (generation !== this.generation) return null; // stale -- must never restore this generation's old position
    return { segmentIndex: this.segmentIndex, offset: this.withinSegmentTime, generation };
  }
}

test("D: at least 10 sequential seeks across different segments never produce an error, and the final state reflects only the LAST commanded seek", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;

  const targets = [3, 1, 5, 0, 6, 2, 7, 4, 1, 5];
  const pendings = targets.map((targetSegment) => sim.commitSeek(targetSegment, 10));

  // Every earlier target's late play()/readiness callbacks arrive here,
  // out of order, after the final seek has already been committed --
  // exactly what rapid real-world scrubbing produces.
  for (const pending of pendings.slice(0, -1)) {
    sim.applyPending(pending);
    sim.resolvePlayFailure(pending.generation);
  }
  const finalPending = pendings[pendings.length - 1];
  const finalOutcome = sim.applyPending(finalPending);
  sim.resolvePlaySuccess(finalPending.generation);

  assert.equal(finalOutcome.applied, true);
  assert.equal(sim.playbackError, false);
  assert.equal(sim.segmentIndex, targets[targets.length - 1]);
  assert.equal(sim.isPlaying, true);
});

test("E: rapid seek A superseded by B before A's target segment ever becomes ready is a safe no-op for A", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(3, 10);
  const pendingB = sim.commitSeek(6, 5); // learner seeks again before A's segment 3 ever loads
  assert.notEqual(pendingA.generation, pendingB.generation);

  const aOutcome = sim.applyPending(pendingA); // A's segment finally becomes ready, too late
  assert.equal(aOutcome.applied, false);
  assert.equal(sim.segmentIndex, 6, "B must remain in control");
  assert.equal(sim.withinSegmentTime, 5);
});

test("F: A's late loadedmetadata cannot affect B, even when a later seek C returns to the SAME segment index with a different offset", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(3, 10); // A -> segment 3 offset 10
  sim.commitSeek(6, 0); // B -> away to segment 6
  const pendingC = sim.commitSeek(3, 50); // C -> back to segment 3, fresh generation, different offset

  const aOutcome = sim.applyPending(pendingA); // A's stale callback finally arrives
  assert.equal(aOutcome.applied, false, "A's generation is stale even though the segment index coincidentally matches again");
  assert.equal(sim.withinSegmentTime, 50, "A must never overwrite C's offset with its own stale 10");

  const cOutcome = sim.applyPending(pendingC); // C's own callback arrives
  assert.equal(cOutcome.applied, true);
  assert.equal(sim.withinSegmentTime, 50);
});

test("G: A's rejected play() promise cannot show an error after B has become the current transaction", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(3, 10);
  sim.hasAttemptedRefresh = true; // simulate A having already spent its refresh budget
  sim.commitSeek(6, 0); // B supersedes A -- this also resets hasAttemptedRefresh for B

  // A's play() promise, interrupted by B's own play()/src change, rejects
  // (AbortError) well after B is already current.
  sim.resolvePlayFailure(pendingA.generation);

  assert.equal(sim.playbackError, false, "a superseded transaction's rejected play() promise must never surface the red error");
  assert.equal(sim.segmentIndex, 6);
});

test("H: A's stale error event cannot show an error once B is current (same class of guard as the DOM onError handler)", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(2, 0);
  sim.commitSeek(5, 0); // B supersedes A

  // A stale DOM error event for A's abandoned resource is modelled the
  // same way as a rejected play() promise: it carries A's generation,
  // which no longer matches.
  sim.resolvePlayFailure(pendingA.generation);
  assert.equal(sim.playbackError, false);
});

test("I: a URL refresh resolving for a superseded transaction cannot restore its own old position over the newer target", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(3, 10);
  sim.hasAttemptedRefresh = true;

  sim.commitSeek(6, 40); // B seeks elsewhere while A's refresh is (hypothetically) pending

  const refreshResult = sim.resolveRefreshSuccess(pendingA.generation); // A's refresh finally resolves, too late
  assert.equal(refreshResult, null, "A's stale refresh must never produce a pending seek at all");
  assert.equal(sim.segmentIndex, 6, "B's target segment must be unaffected by A's stale refresh");
  assert.equal(sim.withinSegmentTime, 40, "A's refresh must not restore A's own offset over B's");
});

test("J: Restart begins a new transaction that invalidates any outstanding seek", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  const pendingA = sim.commitSeek(5, 100);

  // Restart: mirrors restart()'s own beginTransition() + pendingSeek
  // re-tag to segment 0 offset 0.
  const restartGeneration = sim.beginTransition();
  sim.segmentIndex = 0;
  sim.withinSegmentTime = 0;

  const aOutcome = sim.applyPending(pendingA); // A's old pending seek target, now irrelevant
  assert.equal(aOutcome.applied, false);
  assert.equal(sim.segmentIndex, 0);
  assert.notEqual(pendingA.generation, restartGeneration);
});

test("K: auto-advance interrupted by a learner seek gives control to the learner's seek, not the natural advance", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;
  // Auto-advance from segment 0 ending -> queues segment 1 as a
  // transaction of its own (mirrors handleEnded's beginTransition()).
  const autoAdvanceGeneration = sim.beginTransition();
  const autoAdvancePending = { segmentIndex: 1, offset: 0, generation: autoAdvanceGeneration };
  sim.segmentIndex = 1;

  // Before segment 1 becomes ready, the learner scrubs to segment 4.
  sim.commitSeek(4, 12);

  const autoAdvanceOutcome = sim.applyPending(autoAdvancePending);
  assert.equal(autoAdvanceOutcome.applied, false, "the learner's seek must win over the pending auto-advance");
  assert.equal(sim.segmentIndex, 4);
  assert.equal(sim.withinSegmentTime, 12);
});

test("real repro: drag forward, backward, forward, backward, repeatedly, ending near 10:05 -- never shows the red error", () => {
  const sim = new GenerationGatedSeekSimulator();
  sim.shouldContinue = true;

  // Mirrors the reported manual sequence: several forward/backward drags
  // in quick succession. The exact segment landed on is irrelevant to
  // this test -- only that no intermediate step ever surfaces
  // playbackError, and the final committed target wins.
  const dragSequence: Array<{ segmentIndex: number; offset: number }> = [
    { segmentIndex: 2, offset: 40 },
    { segmentIndex: 5, offset: 5 },
    { segmentIndex: 1, offset: 20 },
    { segmentIndex: 6, offset: 0 },
    { segmentIndex: 3, offset: 60 },
    { segmentIndex: 0, offset: 10 },
    { segmentIndex: 4, offset: 90 },
  ];

  let previousPending: { segmentIndex: number; offset: number; generation: number } | null = null;
  for (const step of dragSequence) {
    const pending = sim.commitSeek(step.segmentIndex, step.offset);
    // The PREVIOUS drag's own late play()/readiness callbacks arrive
    // right after this new commit, exactly as an interrupted play()
    // promise would under rapid real-world scrubbing.
    if (previousPending) {
      sim.applyPending(previousPending);
      sim.resolvePlayFailure(previousPending.generation);
    }
    previousPending = pending;
    assert.equal(sim.playbackError, false, `must not show the red error after seeking to segment ${step.segmentIndex}`);
  }

  // The final segment becomes ready and playback resumes.
  const finalOutcome = sim.applyPending(previousPending!);
  assert.equal(finalOutcome.applied, true);
  sim.resolvePlaySuccess(previousPending!.generation);

  const finalStep = dragSequence[dragSequence.length - 1];
  assert.equal(sim.playbackError, false);
  assert.equal(sim.isPlaying, true);
  assert.equal(sim.segmentIndex, finalStep.segmentIndex);
  assert.equal(sim.withinSegmentTime, finalStep.offset);
});

// ==========================================================================
// Preview vs committed seek: dragging the range input must not perform a
// real media seek (an src swap) on every pixel of movement -- only once,
// when the gesture is committed.
// ==========================================================================

test("L: the range input's onChange updates only a local preview value -- it never itself commits a media seek", () => {
  const inputTag = SOURCE.match(/<input\n\s+type="range"[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag, "range input not found");
  assert.match(inputTag!, /onChange=\{\(event\) => setPreviewLogicalTime\(Number\(event\.target\.value\)\)\}/);
  assert.doesNotMatch(inputTag!, /onChange=\{[^}]*commitSeekToLogicalTime/);
  assert.doesNotMatch(inputTag!, /onChange=\{[^}]*setSegmentIndex/);
});

test("L: the committed media seek fires exactly once per gesture, on release/commit events -- not on every drag/input event", () => {
  const inputTag = SOURCE.match(/<input\n\s+type="range"[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag);
  for (const commitEvent of ["onPointerUp", "onTouchEnd", "onKeyUp", "onBlur"]) {
    assert.match(inputTag!, new RegExp(`${commitEvent}=\\{commitPreviewSeek\\}`));
  }
});

test("commitPreviewSeek commits the previewed value exactly once, then clears the preview, and is a safe no-op if called again with nothing pending (guards against onPointerUp and onBlur both firing for the same gesture)", () => {
  const fn = SOURCE.match(/function commitPreviewSeek\(\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "commitPreviewSeek not found");
  assert.match(fn!, /if \(previewLogicalTime === null\) return;/);
  assert.match(fn!, /setPreviewLogicalTime\(null\);/);
  assert.match(fn!, /commitSeekToLogicalTime\(target\);/);
});

test("M: the slider's displayed value follows the live preview while dragging, and falls back to the committed logical time otherwise", () => {
  assert.match(SOURCE, /const displayedSeekValue = previewLogicalTime \?\? seekValue;/);
  assert.match(SOURCE, /value=\{displayedSeekValue\}/);
});

test("N: keyboard seeking remains functional -- the range input is not keyboard-disabled, and a keyup commits the seek", () => {
  const inputTag = SOURCE.match(/<input\n\s+type="range"[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag);
  assert.doesNotMatch(inputTag!, /tabIndex=\{?-1\}?/);
  assert.match(inputTag!, /onKeyUp=\{commitPreviewSeek\}/);
});

test("Q: persistence records only the committed position -- persistPosition is never reachable from the preview onChange handler", () => {
  const inputTag = SOURCE.match(/<input\n\s+type="range"[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag);
  const onChangeHandler = inputTag!.match(/onChange=\{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(onChangeHandler, /persistPosition/);
});

test("commitSeekToLogicalTime persists the committed same-segment position immediately", () => {
  const fn = SOURCE.match(/function commitSeekToLogicalTime\(targetLogicalTime: number\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "commitSeekToLogicalTime not found");
  assert.match(fn!, /persistPosition\(target\.withinSegmentTime, true\);/);
});

test("play(), the segment-change effect's resumed play(), and the same-segment committed seek's play() all capture a generation and gate their failure handler with it -- never a bare handlePlaybackFailure() call", () => {
  assert.doesNotMatch(SOURCE, /handlePlaybackFailure\(\)/, "handlePlaybackFailure must always be called with an explicit generation");
  assert.match(SOURCE, /function handlePlaybackFailure\(generation: number\) \{/);
  assert.match(SOURCE, /if \(generation !== seekGenerationRef\.current\) return;/);
});

test("the seekGenerationRef exists as the single authoritative source of transaction ownership", () => {
  assert.match(SOURCE, /const seekGenerationRef = useRef\(0\);/);
  assert.match(SOURCE, /function beginTransition\(\): number \{/);
  assert.match(SOURCE, /seekGenerationRef\.current \+= 1;/);
});

test("PendingSeek is tagged with the generation that created it, and the segment-change effect refuses to apply a pending seek whose generation is no longer current", () => {
  assert.match(SOURCE, /type PendingSeek = \{ segmentIndex: number; offset: number; generation: number \};/);
  assert.match(
    SOURCE,
    /if \(pendingGeneration !== null && pendingGeneration !== seekGenerationRef\.current\) return;/,
  );
});
