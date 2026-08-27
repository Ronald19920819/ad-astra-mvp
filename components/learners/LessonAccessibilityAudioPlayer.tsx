"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
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
} from "@/lib/accessibility/playbackPosition";

type AudioSegment = { index: number; url: string };
type ReadyAudioStatus = { ready: true; segments: AudioSegment[]; sourceVersion: string };
type AudioStatusResponse = ReadyAudioStatus | { ready: false } | { error: string };

// Tagged with the transaction that created it -- see seekGenerationRef
// below. A pending seek whose generation no longer matches the current
// one is dead and must never be applied.
type PendingSeek = { segmentIndex: number; offset: number; generation: number };

const PLAYBACK_ERROR_MESSAGE = "Audio playback was interrupted. Please try again.";
const POSITION_SAVE_INTERVAL_MS = 5000;
const DEFAULT_PROBE_FALLBACK_SECONDS = 30;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Stage B learner-facing "Listen to this reading" player. Renders nothing
// at all -- not even a placeholder -- unless the server confirms this
// learner is accessibility-entitled. Presents ONE continuous logical
// recording; the underlying technical TTS segments (and their signed
// URLs, which expire after a few minutes) are never exposed to the
// learner.
//
// MEDIA STATE MACHINE / SEEK TRANSACTIONS
// ----------------------------------------
// Every playback transition -- pressing Play, Restart, a committed seek,
// an auto-advance to the next segment, or a signed-URL refresh retry -- is
// a "transaction" identified by a monotonically increasing generation
// number (seekGenerationRef, bumped by beginTransition()). Repeated rapid
// scrubbing means several of these can be in flight at once (an old
// segment's loadedmetadata callback, a stale play() promise, an in-flight
// refresh fetch), and changing <audio>.src itself synchronously fires the
// browser's own load-algorithm noise (spurious pause/error/abort events
// for the resource being ABANDONED). None of that is allowed to reach the
// learner as a failure unless it belongs to the transaction that is still
// current:
//   - Every async continuation of a transaction (a resolved/rejected
//     play() promise, a resolved refresh fetch, a pending seek consumed
//     by the segment-change effect) captures its generation up front and
//     re-checks it against seekGenerationRef.current before touching any
//     playback state. A mismatch means a newer transaction has already
//     superseded it, and the continuation is a silent no-op.
//   - DOM media events (error, ended) are additionally checked against
//     the currently-intended segment's own src, so noise from an already
//     abandoned resource can never be misattributed to the resource we
//     actually asked for.
//   - Starting a new transaction resets hasAttemptedRefreshRef, so every
//     transaction gets its own single-shot signed-URL refresh budget
//     (never a raw infinite retry loop, and never a leftover "already
//     tried" flag from an unrelated superseded transaction).
//
// SEEK INPUT: PREVIEW vs COMMIT
// ------------------------------
// Dragging a native <input type="range"> fires React's onChange
// continuously (it is wired to the DOM 'input' event, not 'change'), so
// treating every onChange as a real seek would perform dozens of
// cross-segment src swaps during a single drag gesture -- exactly what
// destabilised playback under real scrubbing. onChange here only updates
// a local preview value the slider displays; the actual seek (a new
// transaction) commits exactly once, when the gesture ends (pointer/touch
// release, a keyboard step settling, or blur).
export function LessonAccessibilityAudioPlayer({
  lessonId,
  materialId,
}: {
  lessonId: string;
  materialId: string;
}) {
  const [status, setStatus] = useState<"loading" | "hidden" | "not-ready" | "ready">(
    "loading",
  );
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [sourceVersion, setSourceVersion] = useState<string | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [withinSegmentTime, setWithinSegmentTime] = useState(0);
  const [durations, setDurations] = useState<number[] | null>(null);
  const [playbackError, setPlaybackError] = useState(false);
  // Live drag/keyboard value the slider shows immediately; null whenever
  // no gesture is in progress, in which case the slider falls back to the
  // real committed logical time. Never itself persisted or fed into a
  // media seek -- see commitPreviewSeek.
  const [previewLogicalTime, setPreviewLogicalTime] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldContinueRef = useRef(false);
  const pendingSeekRef = useRef<PendingSeek | null>(null);
  const hasAttemptedRefreshRef = useRef(false);
  const lastPersistedAtRef = useRef(0);
  const storageKeyRef = useRef(buildPlaybackPositionStorageKey(lessonId, materialId));
  const restoredOnceRef = useRef(false);
  // The single source of truth for "which transaction is authoritative
  // right now." See the MEDIA STATE MACHINE doc comment above.
  const seekGenerationRef = useRef(0);

  function beginTransition(): number {
    seekGenerationRef.current += 1;
    hasAttemptedRefreshRef.current = false;
    return seekGenerationRef.current;
  }

  useEffect(() => {
    storageKeyRef.current = buildPlaybackPositionStorageKey(lessonId, materialId);
  }, [lessonId, materialId]);

  // Returns null for "not entitled"/absent/error responses -- callers
  // that need to distinguish "hidden" from "not-ready" check response.ready
  // on the non-null result themselves (only the initial-load effect does).
  const fetchStatus = useCallback(async (): Promise<
    ReadyAudioStatus | { ready: false } | null
  > => {
    const response = await fetch(
      `/api/lessons/${encodeURIComponent(lessonId)}/accessibility-audio?materialId=${encodeURIComponent(materialId)}`,
    );

    if (response.status === 403 || response.status === 404) return null;

    const result = (await response.json()) as AudioStatusResponse;
    if (!response.ok || "error" in result) return null;
    return result;
  }, [lessonId, materialId]);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const result = await fetchStatus();
        if (!isActive) return;

        if (!result) {
          setStatus("hidden");
          return;
        }
        if (!result.ready) {
          setStatus("not-ready");
          return;
        }

        setSegments([...result.segments].sort((a, b) => a.index - b.index));
        setSourceVersion(result.sourceVersion);
        setStatus("ready");
      } catch {
        if (isActive) setStatus("hidden");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [fetchStatus]);

  // Client-side duration discovery (no audio regeneration, no new
  // metadata storage): probe each segment's real duration via a hidden,
  // metadata-only Audio() instance. Any segment whose probe fails (e.g. an
  // already-expired signed URL) falls back to the average of the ones
  // that succeeded, so the seek timeline still covers the whole reading.
  useEffect(() => {
    if (segments.length === 0 || durations !== null) return;
    let isActive = true;
    const discovered: Array<number | null> = new Array(segments.length).fill(null);

    Promise.all(
      segments.map(
        (segment) =>
          new Promise<void>((resolve) => {
            const probe = new Audio();
            probe.preload = "metadata";

            function finish(duration: number | null) {
              discovered[segment.index] = duration;
              probe.removeEventListener("loadedmetadata", onLoaded);
              probe.removeEventListener("error", onError);
              resolve();
            }
            function onLoaded() {
              finish(Number.isFinite(probe.duration) ? probe.duration : null);
            }
            function onError() {
              finish(null);
            }

            probe.addEventListener("loadedmetadata", onLoaded);
            probe.addEventListener("error", onError);
            probe.src = segment.url;
          }),
      ),
    ).then(() => {
      if (!isActive) return;
      const known = discovered.filter(
        (value): value is number => value !== null && value > 0,
      );
      const fallback =
        known.length > 0
          ? known.reduce((sum, value) => sum + value, 0) / known.length
          : DEFAULT_PROBE_FALLBACK_SECONDS;
      setDurations(discovered.map((value) => value ?? fallback));
    });

    return () => {
      isActive = false;
    };
  }, [segments, durations]);

  const segmentOffsets = durations ? computeSegmentOffsets(durations) : null;
  const totalDuration = durations ? durations.reduce((sum, value) => sum + value, 0) : 0;
  const logicalTime = segmentOffsets
    ? computeLogicalTime(segmentOffsets, segmentIndex, withinSegmentTime)
    : 0;

  // Restore a saved position once, as soon as we know both the segments
  // and the version they belong to. Never autoplays -- shouldContinueRef
  // stays false until the learner presses Play. Works uniformly whether
  // the restored segment is the current one (index 0) or a later one: the
  // segment-change effect below is the sole consumer of pendingSeekRef in
  // both cases.
  useEffect(() => {
    if (restoredOnceRef.current) return;
    if (status !== "ready" || segments.length === 0 || !sourceVersion) return;
    restoredOnceRef.current = true;

    const saved = readPlaybackPosition(window.localStorage, storageKeyRef.current);
    const restorable = resolveRestorablePosition(saved, {
      sourceVersion,
      segmentCount: segments.length,
    });
    if (!restorable) return;

    pendingSeekRef.current = {
      segmentIndex: restorable.segmentIndex,
      offset: restorable.currentTime,
      generation: beginTransition(),
    };
    setWithinSegmentTime(restorable.currentTime);
    setSegmentIndex(restorable.segmentIndex);
  }, [status, segments.length, sourceVersion]);

  // A saved position that turned out to be within a few seconds of the
  // very end of the whole reading is not meaningfully resumable -- clear
  // it so it doesn't linger. Runs only once durations are known, and only
  // adjusts stored state, never the in-memory position that was already
  // (harmlessly) restored.
  useEffect(() => {
    if (!durations || !restoredOnceRef.current) return;
    if (isNearEnd(logicalTime, totalDuration)) {
      clearPlaybackPosition(window.localStorage, storageKeyRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durations]);

  function persistPosition(currentTime: number, force: boolean) {
    if (!sourceVersion) return;
    const now = Date.now();
    if (!force && now - lastPersistedAtRef.current < POSITION_SAVE_INTERVAL_MS) return;
    lastPersistedAtRef.current = now;

    writePlaybackPosition(window.localStorage, storageKeyRef.current, {
      sourceVersion,
      segmentIndex,
      currentTime,
      savedAt: new Date().toISOString(),
    });
  }

  // Persist on meaningful lifecycle events: leaving the page, closing the
  // tab, or navigating away within the app (component unmount).
  useEffect(() => {
    function handlePageHide() {
      const audioElement = audioRef.current;
      persistPosition(audioElement?.currentTime ?? withinSegmentTime, true);
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      handlePageHide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceVersion, segmentIndex]);

  const currentSegment = segments[segmentIndex] ?? null;
  // handleEnded is memoized (useCallback) against segments.length only, so
  // it must never close over currentSegment directly -- that would freeze
  // it at whatever segment was active the first time the callback was
  // created. This ref stays current every render without forcing the
  // callback (and therefore the <audio> element's onEnded listener) to be
  // recreated on every segment change.
  const currentSegmentRef = useRef<AudioSegment | null>(null);
  useEffect(() => {
    currentSegmentRef.current = currentSegment;
  });

  // Only ever escalates to a learner-facing failure if `generation` is
  // still the current authoritative transaction -- a stale caller (an old
  // play() rejection, an old refresh) is silently ignored, because a
  // newer transaction (another seek, Restart, auto-advance) has already
  // taken ownership of the element.
  function handlePlaybackFailure(generation: number) {
    if (generation !== seekGenerationRef.current) return;

    if (!hasAttemptedRefreshRef.current) {
      hasAttemptedRefreshRef.current = true;
      void attemptUrlRefreshAndRetry(generation);
      return;
    }

    shouldContinueRef.current = false;
    setIsPlaying(false);
    setPlaybackError(true);
  }

  // The <audio> element is reused across every segment change (never
  // remounted), so its native `error` event can fire for a resource we
  // have ALREADY intentionally abandoned -- most concretely, changing
  // .src mid-seek to jump to a different segment can itself surface an
  // error for the outgoing resource. Comparing the event's own
  // currentSrc against the segment we currently intend to be playing is
  // the only reliable way to tell "the outgoing resource made noise
  // while being abandoned" (ignore) apart from "the resource we actually
  // asked for failed" (a genuine failure). This is exactly the class of
  // bug that previously broke continuous auto-advance, now applied to
  // seeking too. The generation check inside handlePlaybackFailure itself
  // additionally covers same-src races (e.g. two same-segment seeks in a
  // row) where no src change occurs at all.
  function handleAudioElementError(event: SyntheticEvent<HTMLAudioElement>) {
    const audioElement = event.currentTarget;
    if (currentSegment && audioElement.currentSrc !== currentSegment.url) {
      return;
    }
    handlePlaybackFailure(seekGenerationRef.current);
  }

  // Signed URLs are short-lived (LESSON_AUDIO_SIGNED_URL_SECONDS, a few
  // minutes). A learner who leaves the page for a while and returns, or
  // listens/scrubs long enough for a segment's URL to have expired, must
  // not be forced into a full browser refresh: request fresh URLs from
  // the same authorized endpoint, preserve the logical position, and
  // retry once. Never loops -- handlePlaybackFailure only calls this on
  // the FIRST failure per transaction (hasAttemptedRefreshRef, reset by
  // beginTransition). Guards its own generation before AND after the
  // async fetch: if the learner has since started a newer transaction
  // (another seek, Restart), this refresh's result is stale and must
  // never be applied -- in particular it must never restore playback to
  // ITS OWN (now superseded) position instead of the newer target.
  async function attemptUrlRefreshAndRetry(generation: number) {
    if (generation !== seekGenerationRef.current) return;

    // withinSegmentTime, not audioRef.current.currentTime: a segment that
    // just changed src (e.g. mid cross-segment seek) reads currentTime as
    // 0 -- a valid number, not null/undefined, so a `?? ` fallback would
    // never trigger and the real intended offset would be silently lost.
    // withinSegmentTime is the authoritative intended position regardless
    // of what the element itself currently reports.
    const preservedTime = withinSegmentTime;

    try {
      const result = await fetchStatus();
      if (generation !== seekGenerationRef.current) return;

      if (!result || !result.ready || result.segments.length !== segments.length) {
        shouldContinueRef.current = false;
        setIsPlaying(false);
        setPlaybackError(true);
        return;
      }

      pendingSeekRef.current = { segmentIndex, offset: preservedTime, generation };
      setSegments([...result.segments].sort((a, b) => a.index - b.index));
      setSourceVersion(result.sourceVersion);
      setRefreshEpoch((epoch) => epoch + 1);
    } catch {
      if (generation !== seekGenerationRef.current) return;
      shouldContinueRef.current = false;
      setIsPlaying(false);
      setPlaybackError(true);
    }
  }

  const handleEnded = useCallback((event: SyntheticEvent<HTMLAudioElement>) => {
    // Same stale-resource guard as handleAudioElementError: an `ended`
    // event for a resource we have already abandoned (e.g. a seek away
    // mid-playback) must never advance the segment index a second time.
    const expectedSegment = currentSegmentRef.current;
    if (expectedSegment && event.currentTarget.currentSrc !== expectedSegment.url) {
      return;
    }

    persistPosition(0, true);
    // A natural end-of-segment advance is its own transaction: if the
    // learner seeks elsewhere before this advance's target segment
    // becomes ready, the learner's seek must win (a fresh, higher
    // generation), and this advance's own pending offset/play must become
    // a no-op -- never fight the learner for control of the element.
    const generation = beginTransition();
    setSegmentIndex((current) => {
      const next = current + 1;
      if (next < segments.length) {
        pendingSeekRef.current = { segmentIndex: next, offset: 0, generation };
        return next;
      }

      // Final segment: stop normally. Never loop, never jump back to
      // the start automatically.
      shouldContinueRef.current = false;
      setIsPlaying(false);
      clearPlaybackPosition(window.localStorage, storageKeyRef.current);
      return current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

  // The single consumer of pendingSeekRef, and the only place that calls
  // play() to continue/resume playback across a segment change. Fires on
  // a natural end-of-segment advance, a committed cross-segment seek, a
  // saved position restore, or a post-refresh retry (refreshEpoch). Only
  // applies a pending seek that is BOTH tagged for the segment now active
  // AND still belongs to the current transaction generation -- one still
  // tagged for a not-yet-reached segment is left untouched for the render
  // that actually activates it, and one superseded by a newer transaction
  // (another seek that landed on this very segment index, Restart, etc.)
  // is silently dropped.
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentSegment) return;

    const pending = pendingSeekRef.current;
    const applicable = pending !== null && pending.segmentIndex === segmentIndex;
    const pendingOffset = applicable ? pending!.offset : null;
    const pendingGeneration = applicable ? pending!.generation : null;
    if (applicable) {
      pendingSeekRef.current = null;
    }

    function afterReady() {
      if (!audioElement) return;
      // Re-verify the target is still what we intend before touching it --
      // if a later seek/refresh has already moved on, this stale
      // callback (which addEventListener's own cleanup should already
      // have removed in the vast majority of cases) must not act.
      if (currentSegment && audioElement.currentSrc !== currentSegment.url) return;
      // A newer transaction has already superseded the one that queued
      // this pending seek -- e.g. the learner scrubbed again while this
      // segment was still loading. Do nothing; the newer transaction owns
      // the element now.
      if (pendingGeneration !== null && pendingGeneration !== seekGenerationRef.current) return;

      if (pendingOffset !== null) {
        // Clamp against the segment's REAL now-known duration, not the
        // earlier client-side probe/estimate used to build the seek
        // timeline -- the two can differ slightly, and landing exactly at
        // or past the true end can behave ambiguously in some browsers.
        const realDuration = audioElement.duration;
        const safeOffset =
          Number.isFinite(realDuration) && realDuration > 0
            ? Math.min(pendingOffset, Math.max(0, realDuration - 0.25))
            : pendingOffset;
        audioElement.currentTime = safeOffset;
        setWithinSegmentTime(safeOffset);
      }
      if (shouldContinueRef.current) {
        const playGeneration = pendingGeneration ?? seekGenerationRef.current;
        audioElement.play().catch(() => handlePlaybackFailure(playGeneration));
      }
    }

    if (audioElement.readyState >= 1) {
      afterReady();
      return;
    }
    audioElement.addEventListener("loadedmetadata", afterReady, { once: true });
    return () => audioElement.removeEventListener("loadedmetadata", afterReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentIndex, status, refreshEpoch]);

  function play() {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const generation = beginTransition();
    shouldContinueRef.current = true;
    setPlaybackError(false);
    audioElement
      .play()
      .then(() => {
        if (generation !== seekGenerationRef.current) return;
        setIsPlaying(true);
      })
      .catch(() => handlePlaybackFailure(generation));
  }

  function pause() {
    shouldContinueRef.current = false;
    persistPosition(audioRef.current?.currentTime ?? withinSegmentTime, true);
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  function togglePlayPause() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function restart() {
    const generation = beginTransition();
    shouldContinueRef.current = true;
    setPlaybackError(false);
    setWithinSegmentTime(0);
    setPreviewLogicalTime(null);
    clearPlaybackPosition(window.localStorage, storageKeyRef.current);
    pendingSeekRef.current = { segmentIndex: 0, offset: 0, generation };
    setSegmentIndex(0);
    setRefreshEpoch((epoch) => epoch + 1);
  }

  function retryAfterError() {
    setPlaybackError(false);
    play();
  }

  // Resolves ONE logical-timeline target into a technical segment +
  // offset and begins a NEW transaction that immediately supersedes
  // anything still in flight from a previous seek, the initial restore,
  // auto-advance, or a signed-URL refresh -- see the MEDIA STATE MACHINE
  // doc comment above. Called only on a committed seek gesture, never on
  // every intermediate slider value while dragging.
  function commitSeekToLogicalTime(targetLogicalTime: number) {
    if (!durations || !segmentOffsets) return;

    const generation = beginTransition();
    const target = resolveSeekTarget(segmentOffsets, durations, targetLogicalTime);
    const wasPlaying = shouldContinueRef.current;

    if (target.segmentIndex === segmentIndex) {
      // No src replacement needed at all -- setting currentTime on the
      // already-loaded element is synchronous and cannot race with
      // itself the way a cross-segment src swap can.
      const audioElement = audioRef.current;
      if (!audioElement) return;
      audioElement.currentTime = target.withinSegmentTime;
      setWithinSegmentTime(target.withinSegmentTime);
      persistPosition(target.withinSegmentTime, true);
      if (wasPlaying) {
        audioElement.play().catch(() => handlePlaybackFailure(generation));
      }
      return;
    }

    pendingSeekRef.current = {
      segmentIndex: target.segmentIndex,
      offset: target.withinSegmentTime,
      generation,
    };
    setWithinSegmentTime(target.withinSegmentTime);
    setSegmentIndex(target.segmentIndex);
  }

  // Commits whatever the learner's gesture last previewed. Idempotent by
  // design (previewLogicalTime is cleared before the real seek runs), so
  // it is safe to wire to more than one "gesture ended" event
  // (pointerup, keyup, touchend, blur) without risking a double seek.
  function commitPreviewSeek() {
    if (previewLogicalTime === null) return;
    const target = previewLogicalTime;
    setPreviewLogicalTime(null);
    commitSeekToLogicalTime(target);
  }

  if (status === "loading" || status === "hidden") return null;

  if (status === "not-ready") {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        Audio version not available yet.
      </div>
    );
  }

  const seekMax = Math.max(1, Math.round(totalDuration));
  const seekValue = Math.min(seekMax, Math.round(logicalTime));
  const displayedSeekValue = previewLogicalTime ?? seekValue;

  return (
    <div className="mt-4 rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Volume2 size={18} className="text-[var(--subject-primary)]" />
        Listen to this Reading
      </div>

      {currentSegment && (
        <audio
          ref={audioRef}
          src={currentSegment.url}
          onEnded={handleEnded}
          onTimeUpdate={(event) => {
            const audioElement = event.currentTarget;
            setWithinSegmentTime(audioElement.currentTime);
            persistPosition(audioElement.currentTime, false);
          }}
          onError={handleAudioElementError}
        />
      )}

      <div className="mt-3">
        <input
          type="range"
          aria-label="Reading playback position"
          min={0}
          max={seekMax}
          step={1}
          value={displayedSeekValue}
          disabled={!durations}
          onChange={(event) => setPreviewLogicalTime(Number(event.target.value))}
          onPointerUp={commitPreviewSeek}
          onTouchEnd={commitPreviewSeek}
          onKeyUp={commitPreviewSeek}
          onBlur={commitPreviewSeek}
          className="w-full accent-[var(--subject-primary)]"
        />
        <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
          <span>{formatTime(displayedSeekValue)}</span>
          <span>{durations ? formatTime(totalDuration) : "--:--"}</span>
        </div>
      </div>

      {playbackError && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">{PLAYBACK_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={retryAfterError}
            className="shrink-0 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause reading" : "Play reading"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--subject-primary)] text-white"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={restart}
          aria-label="Restart reading from the beginning"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
