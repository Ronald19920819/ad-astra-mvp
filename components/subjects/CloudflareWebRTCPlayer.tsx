"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type CloudflarePlaybackDiagnostics = {
  status: WebRTCStatus;
  muted: boolean;
  audioTrackCount: number | null;
  videoTrackCount: number | null;
  connectionState: RTCPeerConnectionState | "unknown";
  iceConnectionState: RTCIceConnectionState | "unknown";
};

export type CloudflarePerformanceDiagnostics = {
  audioJitterMs: number | null;
  audioBufferDelayMs: number | null;
  audioPacketsLost: number | null;
  audioPacketsReceived: number | null;
  audioConcealedSamples: number | null;
  audioConcealmentEvents: number | null;
  audioEstimatedPlayoutTimestamp: number | null;
  videoJitterMs: number | null;
  videoBufferDelayMs: number | null;
  videoPacketsLost: number | null;
  videoPacketsReceived: number | null;
  videoFramesDecoded: number | null;
  videoFramesDropped: number | null;
  videoFramesPerSecond: number | null;
  videoTotalDecodeTimeMs: number | null;
  videoEstimatedPlayoutTimestamp: number | null;
  rttMs: number | null;
  transportLabel: string | null;
};

export type CloudflareWebRTCLogContext = {
  role: "teacher" | "learner";
  subjectKey: string;
};

type CloudflareWebRTCPlayerProps = {
  whepUrl: string;
  onConnected?: () => void;
  // As of the Stage 1 reliability pass, hard failures (WHEP/SDP/pre-track
  // connection errors) are no longer reported through this callback once
  // the bounded retry budget is exhausted -- the player now shows its own
  // recoverable FAILED UI with a manual Try Again action instead of handing
  // off to the caller (LiveClassroomPlayer's HLS iframe fallback) silently.
  // The prop is kept, still accepted, and still wired by callers, but is
  // currently never invoked; left in place in case a future stage needs it.
  onFailure?: () => void;
  requireExplicitAudioJoin?: boolean;
  onDiagnosticsChange?: (diagnostics: CloudflarePlaybackDiagnostics) => void;
  collectPerformanceDiagnostics?: boolean;
  onPerformanceDiagnosticsChange?: (
    diagnostics: CloudflarePerformanceDiagnostics | null,
  ) => void;
  logContext?: CloudflareWebRTCLogContext;
};

type WebRTCStatus =
  | "offline"
  | "connecting"
  | "waiting-for-user"
  | "playing"
  | "reconnecting"
  | "ended"
  | "failed";

type FailedReason = "initial" | "connection-lost";

type FailurePhase =
  | "peer-connection"
  | "transceivers"
  | "offer"
  | "set-local-description"
  | "ice-gathering"
  | "whep-request"
  | "whep-response"
  | "set-remote-description"
  | "autoplay"
  | "connection-state"
  | "ice-connection-state"
  | "timeout";

const WEBRTC_TIMEOUT_MS = 8000;
const OFFLINE_RETRY_MS = 5000;
const DISCONNECT_GRACE_MS = 3000;
// Bounded backoff for hard failures (WHEP request/response errors, SDP
// negotiation errors, pre-track peer-connection/ICE failures) — a
// conceptually separate budget from the unbounded offline/waiting retry
// above. Index 0 is the delay before retry attempt 1, etc. Once this many
// consecutive hard failures have occurred, the player stops retrying
// automatically and shows the FAILED UI with a manual Try Again action.
const HARD_FAILURE_RETRY_DELAYS_MS = [1000, 2000, 4000];
// Bounded backoff for MID-SESSION recovery -- used only after a live track
// had already arrived and the connection subsequently degrades beyond the
// short disconnect-grace window. Conceptually separate from both the
// unbounded offline/waiting retry and the bounded initial hard-failure
// retry above: a teacher starting OBS late must never consume this budget,
// and a mid-lesson network blip must never consume the initial hard-failure
// budget.
const RECONNECT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const OFFLINE_IMAGE_SRC = "/live/currently-offline.png";
let playbackAttemptCounter = 0;

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: error,
    serialized: (() => {
      try {
        return JSON.stringify(error, null, 2);
      } catch {
        return String(error);
      }
    })(),
  };
}

function stringifyDetails(details: unknown) {
  if (details instanceof Error) {
    return details.message;
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function logUnexpectedErrorDetails(prefix: string, details: unknown) {
  if (details instanceof Error) {
    console.error(`${prefix} name:`, details.name);
    console.error(`${prefix} message:`, details.message);
    if (details.stack) {
      console.error(`${prefix} stack:`, details.stack);
    }
    return;
  }

  console.error(`${prefix}:`, stringifyDetails(details));
}

function logExpectedPlayInterruption(prefix: string, details: unknown) {
  if (!IS_DEVELOPMENT) {
    return;
  }

  if (details instanceof Error) {
    console.debug(`${prefix} name:`, details.name);
    console.debug(`${prefix} message:`, details.message);
    return;
  }

  console.debug(`${prefix}:`, stringifyDetails(details));
}

async function readResponseBody(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    return `Unable to read response body: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}

async function waitForIceGatheringComplete(
  peerConnection: RTCPeerConnection,
): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const handleIceGatheringStateChange = () => {
      if (peerConnection.iceGatheringState === "complete") {
        peerConnection.removeEventListener(
          "icegatheringstatechange",
          handleIceGatheringStateChange,
        );
        resolve();
      }
    };

    peerConnection.addEventListener(
      "icegatheringstatechange",
      handleIceGatheringStateChange,
    );
  });
}

export function CloudflareWebRTCPlayer({
  whepUrl,
  onConnected,
  onFailure,
  requireExplicitAudioJoin = false,
  onDiagnosticsChange,
  collectPerformanceDiagnostics = false,
  onPerformanceDiagnosticsChange,
  logContext,
}: CloudflareWebRTCPlayerProps) {
  const logLabel = logContext
    ? `[${logContext.role}:${logContext.subjectKey}]`
    : "[live-classroom]";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionLocationRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const hardFailureRetryTimerRef = useRef<number | null>(null);
  const hardFailureAttemptRef = useRef(0);
  const reconnectRetryTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  // Marks the NEXT attempt as originating from a mid-session reconnect
  // retry, so that if that attempt itself fails (no track within the
  // startup timeout, or a WHEP/SDP error), the failure counts against the
  // bounded reconnect budget rather than silently falling back to the
  // unbounded offline retry or the separate initial hard-failure budget.
  // Set immediately before the attemptNonce bump that starts the attempt,
  // and consumed (read once, then reset) at the top of that attempt.
  const attemptOriginRef = useRef<"other" | "reconnect">("other");
  const disconnectGraceTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  const attemptActiveRef = useRef(false);
  const hasLiveTrackRef = useRef(false);
  const isMountedRef = useRef(false);
  const onConnectedRef = useRef(onConnected);
  const onFailureRef = useRef(onFailure);
  const onDiagnosticsChangeRef = useRef(onDiagnosticsChange);
  const onPerformanceDiagnosticsChangeRef = useRef(onPerformanceDiagnosticsChange);
  const logLabelRef = useRef(logLabel);
  const mediaPlaybackTokenRef = useRef(0);
  const silentRetryRef = useRef(false);
  const hasLearnerJoinedRef = useRef(false);

  const [status, setStatus] = useState<WebRTCStatus>("connecting");
  const [attemptNonce, setAttemptNonce] = useState(0);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [failedReason, setFailedReason] = useState<FailedReason>("initial");
  const [diagnostics, setDiagnostics] = useState<CloudflarePlaybackDiagnostics>({
    status: "connecting",
    muted: false,
    audioTrackCount: null,
    videoTrackCount: null,
    connectionState: "unknown",
    iceConnectionState: "unknown",
  });

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    onFailureRef.current = onFailure;
  }, [onFailure]);

  useEffect(() => {
    onDiagnosticsChangeRef.current = onDiagnosticsChange;
  }, [onDiagnosticsChange]);

  useEffect(() => {
    onPerformanceDiagnosticsChangeRef.current = onPerformanceDiagnosticsChange;
  }, [onPerformanceDiagnosticsChange]);

  useEffect(() => {
    logLabelRef.current = logLabel;
  }, [logLabel]);

  useEffect(() => {
    onDiagnosticsChangeRef.current?.(diagnostics);
  }, [diagnostics]);

  useEffect(() => {
    if (!collectPerformanceDiagnostics) {
      onPerformanceDiagnosticsChangeRef.current?.(null);
    }
  }, [collectPerformanceDiagnostics]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!collectPerformanceDiagnostics) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const toMilliseconds = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value * 1000 : null;

    const getAverageJitterBufferDelayMs = (report: RTCInboundRtpStreamStats) => {
      const delay = report.jitterBufferDelay;
      const emittedCount = report.jitterBufferEmittedCount;

      if (
        typeof delay === "number" &&
        Number.isFinite(delay) &&
        typeof emittedCount === "number" &&
        Number.isFinite(emittedCount) &&
        emittedCount > 0
      ) {
        return (delay / emittedCount) * 1000;
      }

      return null;
    };

    const getTransportLabel = (
      stats: RTCStatsReport,
      selectedCandidatePair: RTCIceCandidatePairStats | null,
    ) => {
      if (!selectedCandidatePair) {
        return null;
      }

      const localCandidate =
        typeof selectedCandidatePair.localCandidateId === "string"
          ? stats.get(selectedCandidatePair.localCandidateId)
          : null;
      const remoteCandidate =
        typeof selectedCandidatePair.remoteCandidateId === "string"
          ? stats.get(selectedCandidatePair.remoteCandidateId)
          : null;
      const candidateType =
        localCandidate?.type === "local-candidate" ||
        localCandidate?.type === "remote-candidate"
          ? localCandidate.candidateType
          : remoteCandidate?.type === "local-candidate" ||
              remoteCandidate?.type === "remote-candidate"
            ? remoteCandidate.candidateType
            : null;
      const protocol =
        localCandidate?.type === "local-candidate" ||
        localCandidate?.type === "remote-candidate"
          ? localCandidate.protocol
          : remoteCandidate?.type === "local-candidate" ||
              remoteCandidate?.type === "remote-candidate"
            ? remoteCandidate.protocol
            : null;
      const upperProtocol =
        typeof protocol === "string" && protocol.length > 0 ? protocol.toUpperCase() : null;

      if (candidateType === "relay") {
        return upperProtocol ? `Relay / TURN (${upperProtocol})` : "Relay / TURN";
      }

      return upperProtocol ? `Direct (${upperProtocol})` : "Direct";
    };

    const sampleStats = async () => {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        onPerformanceDiagnosticsChangeRef.current?.(null);
        return;
      }

      try {
        const stats = await peerConnection.getStats();
        if (cancelled || peerConnectionRef.current !== peerConnection) {
          return;
        }

        let inboundAudio: RTCInboundRtpStreamStats | null = null;
        let inboundVideo: RTCInboundRtpStreamStats | null = null;
        let selectedCandidatePair: RTCIceCandidatePairStats | null = null;

        for (const report of stats.values()) {
          if (
            report.type === "inbound-rtp" &&
            report.kind === "audio" &&
            !report.isRemote
          ) {
            inboundAudio = report;
            continue;
          }

          if (
            report.type === "inbound-rtp" &&
            report.kind === "video" &&
            !report.isRemote
          ) {
            inboundVideo = report;
            continue;
          }

          if (
            report.type === "candidate-pair" &&
            (report.selected === true || report.nominated === true)
          ) {
            selectedCandidatePair = report;
          }
        }

        const performanceDiagnostics: CloudflarePerformanceDiagnostics = {
          audioJitterMs: inboundAudio ? toMilliseconds(inboundAudio.jitter) : null,
          audioBufferDelayMs: inboundAudio
            ? getAverageJitterBufferDelayMs(inboundAudio)
            : null,
          audioPacketsLost:
            inboundAudio && typeof inboundAudio.packetsLost === "number"
              ? inboundAudio.packetsLost
              : null,
          audioPacketsReceived:
            inboundAudio && typeof inboundAudio.packetsReceived === "number"
              ? inboundAudio.packetsReceived
              : null,
          audioConcealedSamples:
            inboundAudio && typeof inboundAudio.concealedSamples === "number"
              ? inboundAudio.concealedSamples
              : null,
          audioConcealmentEvents:
            inboundAudio && typeof inboundAudio.concealmentEvents === "number"
              ? inboundAudio.concealmentEvents
              : null,
          audioEstimatedPlayoutTimestamp:
            inboundAudio && typeof inboundAudio.estimatedPlayoutTimestamp === "number"
              ? inboundAudio.estimatedPlayoutTimestamp
              : null,
          videoJitterMs: inboundVideo ? toMilliseconds(inboundVideo.jitter) : null,
          videoBufferDelayMs: inboundVideo
            ? getAverageJitterBufferDelayMs(inboundVideo)
            : null,
          videoPacketsLost:
            inboundVideo && typeof inboundVideo.packetsLost === "number"
              ? inboundVideo.packetsLost
              : null,
          videoPacketsReceived:
            inboundVideo && typeof inboundVideo.packetsReceived === "number"
              ? inboundVideo.packetsReceived
              : null,
          videoFramesDecoded:
            inboundVideo && typeof inboundVideo.framesDecoded === "number"
              ? inboundVideo.framesDecoded
              : null,
          videoFramesDropped:
            inboundVideo && typeof inboundVideo.framesDropped === "number"
              ? inboundVideo.framesDropped
              : null,
          videoFramesPerSecond:
            inboundVideo && typeof inboundVideo.framesPerSecond === "number"
              ? inboundVideo.framesPerSecond
              : null,
          videoTotalDecodeTimeMs:
            inboundVideo && typeof inboundVideo.totalDecodeTime === "number"
              ? inboundVideo.totalDecodeTime * 1000
              : null,
          videoEstimatedPlayoutTimestamp:
            inboundVideo && typeof inboundVideo.estimatedPlayoutTimestamp === "number"
              ? inboundVideo.estimatedPlayoutTimestamp
              : null,
          rttMs:
            selectedCandidatePair &&
            typeof selectedCandidatePair.currentRoundTripTime === "number"
              ? selectedCandidatePair.currentRoundTripTime * 1000
              : null,
          transportLabel: getTransportLabel(stats, selectedCandidatePair),
        };

        onPerformanceDiagnosticsChangeRef.current?.(performanceDiagnostics);
      } catch {
        if (!cancelled) {
          onPerformanceDiagnosticsChangeRef.current?.(null);
        }
      }
    };

    void sampleStats();
    intervalId = window.setInterval(() => {
      void sampleStats();
    }, 3000);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      onPerformanceDiagnosticsChangeRef.current?.(null);
    };
  }, [attemptNonce, collectPerformanceDiagnostics]);

  useEffect(() => {
    playbackAttemptCounter += 1;
    const attemptId = playbackAttemptCounter;
    let isCancelled = false;
    const abortController = new AbortController();
    const videoElement = videoRef.current;

    const updateDiagnostics = (patch: Partial<CloudflarePlaybackDiagnostics>) => {
      if (!isMountedRef.current || isCancelled) return;
      setDiagnostics((current) => ({ ...current, ...patch }));
    };

    const syncMediaDiagnostics = () => {
      const currentVideoElement = videoRef.current;
      const remoteStream = remoteStreamRef.current;
      updateDiagnostics({
        muted: currentVideoElement?.muted ?? false,
        audioTrackCount: remoteStream ? remoteStream.getAudioTracks().length : null,
        videoTrackCount: remoteStream ? remoteStream.getVideoTracks().length : null,
      });
    };

    const invalidatePlaybackAttempt = (reason: string) => {
      mediaPlaybackTokenRef.current += 1;
      if (IS_DEVELOPMENT) {
        console.debug("Invalidating media playback attempt:", {
          reason,
          token: mediaPlaybackTokenRef.current,
          whepAttempt: attemptId,
        });
      }
    };

    const clearRetryTimer = () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearHardFailureRetryTimer = () => {
      if (hardFailureRetryTimerRef.current !== null) {
        window.clearTimeout(hardFailureRetryTimerRef.current);
        hardFailureRetryTimerRef.current = null;
      }
    };

    const clearReconnectRetryTimer = () => {
      if (reconnectRetryTimerRef.current !== null) {
        window.clearTimeout(reconnectRetryTimerRef.current);
        reconnectRetryTimerRef.current = null;
      }
    };

    const clearDisconnectGraceTimer = () => {
      if (disconnectGraceTimerRef.current !== null) {
        window.clearTimeout(disconnectGraceTimerRef.current);
        disconnectGraceTimerRef.current = null;
      }
    };

    const clearAttemptTimeout = () => {
      if (timeoutTimerRef.current !== null) {
        window.clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };

    const clearVideoElement = () => {
      const currentVideoElement = videoRef.current;
      if (!currentVideoElement) {
        return;
      }

      invalidatePlaybackAttempt("clear_video_element");
      currentVideoElement.pause();
      currentVideoElement.srcObject = null;
      currentVideoElement.removeAttribute("src");
      currentVideoElement.load();
      syncMediaDiagnostics();
    };

    const stopRemoteStream = () => {
      const remoteStream = remoteStreamRef.current;
      if (!remoteStream) {
        return;
      }

      for (const track of remoteStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // no-op
        }
        remoteStream.removeTrack(track);
      }

      remoteStreamRef.current = null;
      syncMediaDiagnostics();
    };

    const closeExistingPeerConnection = (reason: string) => {
      if (peerConnectionRef.current) {
        if (IS_DEVELOPMENT) {
          console.info("Closing existing Cloudflare WebRTC peer connection");
          console.info("WHEP close reason:", reason);
          console.info("WHEP attempt:", attemptId);
        }
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      updateDiagnostics({
        connectionState: "unknown",
        iceConnectionState: "unknown",
      });
    };

    const cleanupSession = () => {
      const sessionLocation = sessionLocationRef.current;
      sessionLocationRef.current = null;

      if (!sessionLocation) {
        return;
      }

      void fetch(sessionLocation, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined);
    };

    const scheduleRetry = (reason: string) => {
      if (
        !isMountedRef.current ||
        retryTimerRef.current !== null ||
        attemptActiveRef.current
      ) {
        return;
      }

      if (IS_DEVELOPMENT) {
        console.info("Scheduling Cloudflare WHEP retry");
        console.info("WHEP retry reason:", reason);
        console.info("WHEP retry interval ms:", OFFLINE_RETRY_MS);
      }

      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        if (!isMountedRef.current || attemptActiveRef.current) {
          return;
        }
        silentRetryRef.current = true;
        setAttemptNonce((current) => current + 1);
      }, OFFLINE_RETRY_MS);
    };

    const scheduleHardFailureRetry = (delayMs: number, phase: FailurePhase) => {
      if (
        !isMountedRef.current ||
        hardFailureRetryTimerRef.current !== null ||
        attemptActiveRef.current
      ) {
        return;
      }

      console.info(
        `${logLabelRef.current} Hard failure (${phase}); scheduling retry attempt ${hardFailureAttemptRef.current + 1}/${HARD_FAILURE_RETRY_DELAYS_MS.length + 1} in ${delayMs}ms.`,
      );

      hardFailureRetryTimerRef.current = window.setTimeout(() => {
        hardFailureRetryTimerRef.current = null;
        if (!isMountedRef.current || attemptActiveRef.current) {
          return;
        }
        silentRetryRef.current = true;
        setAttemptNonce((current) => current + 1);
      }, delayMs);
    };

    const scheduleReconnectRetry = (delayMs: number) => {
      if (
        !isMountedRef.current ||
        reconnectRetryTimerRef.current !== null ||
        attemptActiveRef.current
      ) {
        return;
      }

      reconnectRetryTimerRef.current = window.setTimeout(() => {
        reconnectRetryTimerRef.current = null;
        if (!isMountedRef.current || attemptActiveRef.current) {
          return;
        }
        silentRetryRef.current = true;
        attemptOriginRef.current = "reconnect";
        setAttemptNonce((current) => current + 1);
      }, delayMs);
    };

    // Mid-session recovery: only reached when a live track had already
    // arrived and the connection subsequently degraded beyond the short
    // disconnect-grace window. Deliberately distinct from
    // transitionToOffline: we do NOT know from client-side WHEP alone
    // whether the teacher ended OBS, the learner's network failed, or
    // Cloudflare's session failed, so we neither claim the lesson "ended"
    // nor fall back to the unbounded offline/waiting retry -- we run a
    // bounded fresh-WHEP recovery attempt sequence, and only fall through
    // to the existing Stage 1 FAILED UI (with connection-lost wording) once
    // that budget is exhausted.
    const transitionToReconnecting = (reason: string) => {
      if (isCancelled) return;

      invalidatePlaybackAttempt(`transition_to_reconnecting:${reason}`);
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      clearHardFailureRetryTimer();
      cleanupSession();
      stopRemoteStream();
      // Deliberately NOT calling clearVideoElement() here: we want the
      // video element's last rendered frame to remain visible (dimmed,
      // with a small "Reconnecting..." indicator) rather than blanking to
      // the offline placeholder, per the Stage 2 RECONNECTING UI design.
      closeExistingPeerConnection(reason);
      hasLiveTrackRef.current = false;
      attemptActiveRef.current = false;
      setJoinMessage(null);

      reconnectAttemptRef.current += 1;
      const reconnectAttemptNumber = reconnectAttemptRef.current;

      if (isMountedRef.current && !isCancelled) {
        setStatus("reconnecting");
      }

      if (reconnectAttemptNumber <= RECONNECT_RETRY_DELAYS_MS.length) {
        const delay = RECONNECT_RETRY_DELAYS_MS[reconnectAttemptNumber - 1];
        console.info(
          `${logLabelRef.current} Reconnecting (${reason}); attempt ${reconnectAttemptNumber}/${RECONNECT_RETRY_DELAYS_MS.length} in ${delay}ms.`,
        );
        scheduleReconnectRetry(delay);
        return;
      }

      console.error(
        `${logLabelRef.current} Mid-session reconnect budget exhausted after ${reconnectAttemptNumber} attempts (${reason}); showing FAILED UI.`,
      );

      setFailedReason("connection-lost");
      if (isMountedRef.current) {
        setStatus("failed");
      }
    };

    const transitionToOffline = (reason: string, nextStatus: "offline" | "ended") => {
      invalidatePlaybackAttempt(`transition_to_${nextStatus}`);
      // Reaching a clean offline/ended determination means any prior hard
      // failure or mid-session reconnect streak is no longer relevant to
      // this attempt's health.
      hardFailureAttemptRef.current = 0;
      reconnectAttemptRef.current = 0;
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      clearReconnectRetryTimer();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection(reason);
      hasLiveTrackRef.current = false;
      attemptActiveRef.current = false;
      setJoinMessage(null);

      if (isMountedRef.current && !isCancelled) {
        setStatus(nextStatus);
      }

      scheduleRetry(reason);
    };

    const reportFailure = (phase: FailurePhase, details?: unknown) => {
      if (isCancelled) return;

      console.error(`${logLabelRef.current} Cloudflare WHEP playback failed`);
      console.error("WHEP attempt:", attemptId);
      console.error("WHEP phase:", phase);
      console.error("WHEP URL:", whepUrl);
      console.error("WHEP details:", stringifyDetails(details));
      logUnexpectedErrorDetails("WHEP diagnostic", details);

      if (isReconnectAttempt) {
        // This attempt was itself a mid-session reconnect retry -- a
        // failure here (WHEP/SDP error, pre-track connection issue) stays
        // on the reconnect budget rather than switching to the separate
        // initial hard-failure budget, so messaging/UX stays consistent
        // ("Connection to the live lesson was lost") and neither budget
        // can silently borrow the other's allowance.
        transitionToReconnecting(`reconnect_attempt_failure:${phase}`);
        return;
      }

      invalidatePlaybackAttempt(`failure:${phase}`);
      reconnectAttemptRef.current = 0;
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      clearHardFailureRetryTimer();
      clearReconnectRetryTimer();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection(`failure:${phase}`);
      hasLiveTrackRef.current = false;
      attemptActiveRef.current = false;
      setJoinMessage(null);

      // Bounded hard-failure retry, deliberately separate from the
      // unbounded offline/waiting retry above. This covers WHEP
      // request/response failures, SDP negotiation failures, and pre-track
      // peer-connection/ICE failures -- previously these left the player
      // permanently stuck with no automatic recovery and no visible UI.
      //
      // Note: a non-NotAllowedError autoplay failure (see the "autoplay"
      // call site below) also reports through here today, so it now shares
      // this same bounded retry rather than being a separate dead end --
      // safe (still bounded, still fully torn down and rebuilt each try)
      // but audio-policy failures and connection-health failures remain
      // conflated. Decoupling that is left for a later stage.
      hardFailureAttemptRef.current += 1;
      const hardFailureAttemptNumber = hardFailureAttemptRef.current;

      if (hardFailureAttemptNumber <= HARD_FAILURE_RETRY_DELAYS_MS.length) {
        scheduleHardFailureRetry(
          HARD_FAILURE_RETRY_DELAYS_MS[hardFailureAttemptNumber - 1],
          phase,
        );
        return;
      }

      console.error(
        `${logLabelRef.current} Hard failure retry budget exhausted after ${hardFailureAttemptNumber} attempts (${phase}); showing FAILED UI.`,
      );

      setFailedReason("initial");
      if (isMountedRef.current) {
        setStatus("failed");
      }

      // Deliberately NOT calling onFailureRef here (see component-level
      // comment on the `onFailure` prop): the player now has its own
      // recoverable FAILED UI with a manual Try Again action, which is a
      // strictly more informative and recoverable outcome than the prior
      // silent, permanent hand-off to the HLS iframe fallback.
    };

    if (IS_DEVELOPMENT) {
      console.info(`WHEP attempt ${attemptId}`);
      console.info("WHEP startPlayback started");
      console.info("WHEP URL:", whepUrl);
    }

    clearRetryTimer();
    clearHardFailureRetryTimer();
    clearReconnectRetryTimer();
    clearDisconnectGraceTimer();
    clearAttemptTimeout();
    cleanupSession();
    stopRemoteStream();
    clearVideoElement();
    closeExistingPeerConnection("starting_new_session");
    invalidatePlaybackAttempt("new_whep_session_start");
    hasLiveTrackRef.current = false;
    attemptActiveRef.current = true;
    const isSilentRetry = silentRetryRef.current;
    silentRetryRef.current = false;
    // Consumed once per attempt: whether THIS attempt was scheduled by the
    // mid-session reconnect retry mechanism, so failures within it stay on
    // the reconnect budget (see reportFailure and the no-track timeout
    // below) instead of switching to a different budget/messaging mid-flow.
    const isReconnectAttempt = attemptOriginRef.current === "reconnect";
    attemptOriginRef.current = "other";
    if (isMountedRef.current && !isSilentRetry) {
      setStatus("connecting");
    }
    updateDiagnostics({
      status: "connecting",
      muted: videoElement?.muted ?? false,
      audioTrackCount: null,
      videoTrackCount: null,
      connectionState: "unknown",
      iceConnectionState: "unknown",
    });

    timeoutTimerRef.current = window.setTimeout(() => {
      if (!hasLiveTrackRef.current) {
        if (isReconnectAttempt) {
          // A mid-session reconnect attempt that itself never received a
          // live track is a failed reconnect attempt, not a fresh "OBS
          // hasn't started" reading -- keep it on the bounded reconnect
          // budget instead of falling back to the unbounded offline retry.
          console.info(
            `${logLabelRef.current} Reconnect attempt ${attemptId} timed out after ${WEBRTC_TIMEOUT_MS}ms without a live track.`,
          );
          transitionToReconnecting("reconnect_attempt_no_track_timeout");
          return;
        }

        // Always-on (not IS_DEVELOPMENT-gated): this is the exact transition
        // that produces the "stuck on offline placeholder" symptom, and it
        // is the one diagnostic signal needed to tell whether this viewer's
        // WHEP session ever received a live track. Contains no secrets.
        console.info(
          `${logLabelRef.current} WHEP attempt ${attemptId} timed out after ${WEBRTC_TIMEOUT_MS}ms without a live track; showing offline placeholder.`,
        );
        transitionToOffline("offline_start_timeout", "offline");
        return;
      }

      reportFailure("timeout", {
        timeoutMs: WEBRTC_TIMEOUT_MS,
      });
    }, WEBRTC_TIMEOUT_MS);

    async function startPlayback() {
      let peerConnection: RTCPeerConnection;

      try {
        peerConnection = new RTCPeerConnection();
      } catch (error) {
        reportFailure("peer-connection", error);
        return;
      }

      peerConnectionRef.current = peerConnection;
      updateDiagnostics({
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
      });

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      if (videoElement) {
        videoElement.srcObject = remoteStream;
      }
      syncMediaDiagnostics();

      try {
        peerConnection.addTransceiver("audio", { direction: "recvonly" });
        peerConnection.addTransceiver("video", { direction: "recvonly" });
      } catch (error) {
        reportFailure("transceivers", error);
        return;
      }

      // A single track ending is not, by itself, proof the whole session
      // died -- Cloudflare/OBS may drop only audio or only video briefly.
      // If a track of the OTHER kind is still live, give it a short settle
      // window (reusing the existing disconnect-grace duration) before
      // deciding the session genuinely needs full recovery. Deliberately
      // simple: no per-track reconstruction, just "is anything still live".
      const handleTrackEnded = (endedTrack: MediaStreamTrack) => {
        if (peerConnectionRef.current !== peerConnection || isCancelled) {
          return;
        }

        if (IS_DEVELOPMENT) {
          console.info(`Cloudflare WHEP ${endedTrack.kind} track ended`);
        }

        const remainingLiveTracks = remoteStream
          .getTracks()
          .filter((track) => track !== endedTrack && track.readyState === "live");

        if (remainingLiveTracks.length > 0) {
          console.info(
            `${logLabelRef.current} ${endedTrack.kind} track ended; ${remainingLiveTracks.length} other track(s) still live, waiting briefly before recovering.`,
          );

          clearDisconnectGraceTimer();
          disconnectGraceTimerRef.current = window.setTimeout(() => {
            disconnectGraceTimerRef.current = null;
            if (isCancelled || peerConnectionRef.current !== peerConnection) {
              return;
            }

            const stillHasLiveTrack = remoteStreamRef.current
              ? remoteStreamRef.current
                  .getTracks()
                  .some((track) => track.readyState === "live")
              : false;

            if (stillHasLiveTrack) {
              return;
            }

            transitionToReconnecting(
              `track_ended_${endedTrack.kind}_no_remaining_live_tracks`,
            );
          }, DISCONNECT_GRACE_MS);
          return;
        }

        transitionToReconnecting(`track_ended_${endedTrack.kind}`);
      };

      peerConnection.addEventListener("track", (event) => {
        const incomingTracks = event.streams[0]?.getTracks() ?? [event.track];

        for (const track of incomingTracks) {
          if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
            remoteStream.addTrack(track);
          }

          track.onended = () => {
            handleTrackEnded(track);
          };
        }

        hasLiveTrackRef.current = true;
        // A live track arriving means any prior hard failure or mid-session
        // reconnect streak is over.
        hardFailureAttemptRef.current = 0;
        reconnectAttemptRef.current = 0;
        clearDisconnectGraceTimer();
        clearAttemptTimeout();
        syncMediaDiagnostics();

        if (!videoElement || isCancelled) {
          return;
        }

        const playbackToken = mediaPlaybackTokenRef.current;

        const playWithAudio = async () => {
          videoElement.muted = false;
          syncMediaDiagnostics();
          await videoElement.play();
        };

        const playMuted = async () => {
          videoElement.muted = true;
          syncMediaDiagnostics();
          await videoElement.play();
        };

        void playWithAudio()
          .then(() => {
            if (isCancelled || playbackToken !== mediaPlaybackTokenRef.current) {
              return;
            }
            attemptActiveRef.current = false;
            syncMediaDiagnostics();
            if (isMountedRef.current) {
              setStatus("playing");
            }
            onConnectedRef.current?.();
          })
          .catch(async (error) => {
            const errorName = error instanceof Error ? error.name : "";
            const errorMessage =
              error instanceof Error ? error.message : stringifyDetails(error);

            if (playbackToken !== mediaPlaybackTokenRef.current) {
              logExpectedPlayInterruption(
                "Stale Cloudflare WHEP play() rejection ignored",
                error,
              );
              return;
            }

            if (errorName === "AbortError") {
              logExpectedPlayInterruption(
                "Cloudflare WHEP play() was interrupted",
                error,
              );
              return;
            }

            if (errorName === "NotAllowedError") {
              if (IS_DEVELOPMENT) {
                console.info(
                  "Cloudflare WHEP autoplay with sound was blocked; trying muted autoplay.",
                );
              }

              try {
                await playMuted();
              } catch (mutedError) {
                if (playbackToken !== mediaPlaybackTokenRef.current) {
                  logExpectedPlayInterruption(
                    "Stale muted autoplay rejection ignored",
                    mutedError,
                  );
                  return;
                }

                const mutedErrorName =
                  mutedError instanceof Error ? mutedError.name : "";

                if (mutedErrorName === "AbortError") {
                  logExpectedPlayInterruption(
                    "Muted autoplay was interrupted",
                    mutedError,
                  );
                  return;
                }

                if (IS_DEVELOPMENT) {
                  logExpectedPlayInterruption(
                    "Muted autoplay diagnostic",
                    mutedError,
                  );
                }
              }

              if (isCancelled || playbackToken !== mediaPlaybackTokenRef.current) {
                return;
              }
              attemptActiveRef.current = false;
              setJoinMessage(null);
              if (isMountedRef.current) {
                setStatus("waiting-for-user");
              }
              onConnectedRef.current?.();
              return;
            }

            if (IS_DEVELOPMENT) {
              console.warn("Cloudflare WHEP play() failed after track arrival.");
              console.warn("WHEP attempt:", attemptId);
              console.warn("WHEP play error name:", errorName);
              console.warn("WHEP play error message:", errorMessage);
            }
            reportFailure("autoplay", error);
          });
      });

      peerConnection.addEventListener("connectionstatechange", () => {
        // Stale-connection guard: once a peer connection has been replaced
        // or intentionally closed (closeExistingPeerConnection nulls the
        // ref synchronously), any later event it still fires -- including
        // the "closed" transition close() itself causes -- must not trigger
        // recovery. This also prevents connectionState and
        // iceConnectionState from both independently reacting to the same
        // real degradation once the first one has already started recovery.
        if (peerConnectionRef.current !== peerConnection) {
          return;
        }

        updateDiagnostics({ connectionState: peerConnection.connectionState });
        if (IS_DEVELOPMENT) {
          console.info("WHEP connection state:", peerConnection.connectionState);
        }

        if (peerConnection.connectionState === "connected") {
          if (disconnectGraceTimerRef.current !== null) {
            console.info(
              `${logLabelRef.current} Connection recovered within the disconnect grace window.`,
            );
          }
          clearDisconnectGraceTimer();
          return;
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "closed"
        ) {
          if (hasLiveTrackRef.current) {
            transitionToReconnecting(`connection_${peerConnection.connectionState}`);
            return;
          }

          reportFailure("connection-state", {
            connectionState: peerConnection.connectionState,
          });
          return;
        }

        if (peerConnection.connectionState === "disconnected") {
          clearDisconnectGraceTimer();
          console.info(
            `${logLabelRef.current} Connection disconnected; starting ${DISCONNECT_GRACE_MS}ms grace period.`,
          );
          disconnectGraceTimerRef.current = window.setTimeout(() => {
            disconnectGraceTimerRef.current = null;
            if (
              peerConnectionRef.current !== peerConnection ||
              peerConnection.connectionState !== "disconnected"
            ) {
              return;
            }

            if (hasLiveTrackRef.current) {
              transitionToReconnecting("connection_disconnected_grace_elapsed");
              return;
            }

            reportFailure("connection-state", {
              connectionState: peerConnection.connectionState,
            });
          }, DISCONNECT_GRACE_MS);
        }
      });

      peerConnection.addEventListener("iceconnectionstatechange", () => {
        if (peerConnectionRef.current !== peerConnection) {
          return;
        }

        updateDiagnostics({ iceConnectionState: peerConnection.iceConnectionState });
        if (IS_DEVELOPMENT) {
          console.info("WHEP ICE connection state:", peerConnection.iceConnectionState);
        }

        if (
          peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "completed"
        ) {
          if (disconnectGraceTimerRef.current !== null) {
            console.info(
              `${logLabelRef.current} ICE connection recovered within the disconnect grace window.`,
            );
          }
          clearDisconnectGraceTimer();
          return;
        }

        if (
          peerConnection.iceConnectionState === "failed" ||
          peerConnection.iceConnectionState === "closed"
        ) {
          if (hasLiveTrackRef.current) {
            transitionToReconnecting(`ice_${peerConnection.iceConnectionState}`);
            return;
          }

          reportFailure("ice-connection-state", {
            iceConnectionState: peerConnection.iceConnectionState,
          });
          return;
        }

        if (peerConnection.iceConnectionState === "disconnected") {
          clearDisconnectGraceTimer();
          console.info(
            `${logLabelRef.current} ICE connection disconnected; starting ${DISCONNECT_GRACE_MS}ms grace period.`,
          );
          disconnectGraceTimerRef.current = window.setTimeout(() => {
            disconnectGraceTimerRef.current = null;
            if (
              peerConnectionRef.current !== peerConnection ||
              peerConnection.iceConnectionState !== "disconnected"
            ) {
              return;
            }

            if (hasLiveTrackRef.current) {
              transitionToReconnecting("ice_disconnected_grace_elapsed");
              return;
            }

            reportFailure("ice-connection-state", {
              iceConnectionState: peerConnection.iceConnectionState,
            });
          }, DISCONNECT_GRACE_MS);
        }
      });

      if (IS_DEVELOPMENT) {
        peerConnection.addEventListener("icegatheringstatechange", () => {
          console.info("WHEP ICE gathering state:", peerConnection.iceGatheringState);
        });

        peerConnection.addEventListener("signalingstatechange", () => {
          console.info("WHEP signaling state:", peerConnection.signalingState);
        });
      }

      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await waitForIceGatheringComplete(peerConnection);

        if (!peerConnection.localDescription?.sdp) {
          reportFailure("offer", {
            message: "Missing WebRTC offer SDP after setLocalDescription.",
          });
          return;
        }

        let response: Response;
        try {
          response = await fetch(whepUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              Accept: "application/sdp",
            },
            body: peerConnection.localDescription.sdp,
            signal: abortController.signal,
          });
        } catch (error) {
          reportFailure("whep-request", error);
          return;
        }

        const responseBody = await readResponseBody(response);

        if (!response.ok) {
          if (response.status === 409) {
            if (IS_DEVELOPMENT) {
              console.info(
                "Cloudflare WHEP stream is not live yet; treating as offline state.",
              );
              console.info("WHEP attempt:", attemptId);
            }
            transitionToOffline("offline_409_not_started", "offline");
            return;
          }

          reportFailure("whep-response", {
            status: response.status,
            statusText: response.statusText,
            responseUrl: response.url,
            contentType: response.headers.get("Content-Type"),
            location: response.headers.get("Location"),
            protocolVersion: response.headers.get("protocol-version"),
            body: responseBody,
          });
          return;
        }

        const answerSdp = responseBody;

        if (!answerSdp.trim()) {
          reportFailure("whep-response", {
            status: response.status,
            statusText: response.statusText,
            responseUrl: response.url,
            contentType: response.headers.get("Content-Type"),
            location: response.headers.get("Location"),
            protocolVersion: response.headers.get("protocol-version"),
            body: answerSdp,
            message: "Missing WebRTC answer SDP.",
          });
          return;
        }

        const sessionLocation = response.headers.get("Location");
        if (sessionLocation) {
          sessionLocationRef.current = new URL(sessionLocation, whepUrl).toString();
        }

        try {
          await peerConnection.setRemoteDescription({
            type: "answer",
            sdp: answerSdp,
          });
        } catch (error) {
          reportFailure("set-remote-description", {
            answerLength: answerSdp.length,
            diagnostic: describeError(error),
          });
        }
      } catch (error) {
        if (abortController.signal.aborted || isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown error";

        if (message.includes("setLocalDescription")) {
          reportFailure("set-local-description", error);
          return;
        }

        if (message.includes("createOffer")) {
          reportFailure("offer", error);
          return;
        }

        reportFailure("ice-gathering", error);
      }
    }

    void startPlayback();

    return () => {
      isCancelled = true;
      invalidatePlaybackAttempt("component_unmount");
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      clearRetryTimer();
      clearHardFailureRetryTimer();
      clearReconnectRetryTimer();
      abortController.abort();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection("component_unmount");
      attemptActiveRef.current = false;
      hasLiveTrackRef.current = false;
    };
  }, [attemptNonce, whepUrl]);

  const handleTryAgain = () => {
    if (attemptActiveRef.current) {
      return;
    }

    if (hardFailureRetryTimerRef.current !== null) {
      window.clearTimeout(hardFailureRetryTimerRef.current);
      hardFailureRetryTimerRef.current = null;
    }

    if (reconnectRetryTimerRef.current !== null) {
      window.clearTimeout(reconnectRetryTimerRef.current);
      reconnectRetryTimerRef.current = null;
    }

    console.info(
      `${logLabelRef.current} Manual Try Again requested; resetting hard failure and reconnect budgets.`,
    );

    hardFailureAttemptRef.current = 0;
    reconnectAttemptRef.current = 0;
    silentRetryRef.current = false;
    setAttemptNonce((current) => current + 1);
  };

  const showOfflineImage =
    status === "offline" ||
    status === "connecting" ||
    status === "ended" ||
    status === "failed";
  const showJoinOverlay = status === "waiting-for-user" && requireExplicitAudioJoin;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {showOfflineImage ? (
        <Image
          src={OFFLINE_IMAGE_SRC}
          alt="Live Classroom currently offline"
          fill
          className="bg-black object-contain object-center"
          sizes="(max-width: 1024px) 100vw, 70vw"
          priority
        />
      ) : null}

      <video
        ref={videoRef}
        className={`h-full w-full ${showOfflineImage ? "opacity-0" : "opacity-100"}`}
        autoPlay
        playsInline
        controls
      />

      {status === "connecting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 px-4 text-center text-sm font-medium text-white">
          Connecting to the live stream...
        </div>
      ) : null}

      {status === "reconnecting" ? (
        <div className="absolute inset-0 flex items-end justify-center bg-slate-950/20 px-4 pb-6">
          <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-sm font-medium text-white shadow-sm">
            <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-400" />
            Reconnecting to the live lesson…
          </div>
        </div>
      ) : null}

      {showJoinOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 px-4 text-center">
          <div className="max-w-sm space-y-4 rounded-[1.5rem] border border-white/15 bg-slate-950/75 p-6 shadow-lg backdrop-blur-sm">
            <div className="space-y-2">
              <p className="text-lg font-bold text-white">Live lesson ready</p>
              <p className="text-sm text-white/90">
                Join the lesson to enable video and sound.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const currentVideoElement = videoRef.current;
                if (!currentVideoElement) return;
                hasLearnerJoinedRef.current = true;
                setJoinMessage(null);
                currentVideoElement.muted = false;
                setDiagnostics((current) => ({ ...current, muted: false }));
                const playbackToken = mediaPlaybackTokenRef.current;
                void currentVideoElement.play().then(() => {
                  if (playbackToken !== mediaPlaybackTokenRef.current) {
                    return;
                  }
                  setStatus("playing");
                  setJoinMessage(null);
                  setDiagnostics((current) => ({ ...current, muted: currentVideoElement.muted }));
                }).catch((error) => {
                  const errorName = error instanceof Error ? error.name : "";

                  if (playbackToken !== mediaPlaybackTokenRef.current) {
                    logExpectedPlayInterruption(
                      "Stale manual playback rejection ignored",
                      error,
                    );
                    return;
                  }

                  if (errorName === "AbortError") {
                    logExpectedPlayInterruption(
                      "Manual Cloudflare WHEP playback was interrupted",
                      error,
                    );
                    return;
                  }

                  if (errorName === "NotAllowedError") {
                    setJoinMessage(
                      "Your browser is blocking sound. Tap Join Live Lesson again or check your device volume.",
                    );
                    return;
                  }

                  console.warn("Manual Cloudflare WHEP playback start failed");
                  logUnexpectedErrorDetails("Manual WHEP playback diagnostic", error);
                  setJoinMessage(
                    "Your browser is blocking sound. Tap Join Live Lesson again or check your device volume.",
                  );
                });
              }}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Join Live Lesson
            </button>
            {joinMessage ? (
              <p className="text-xs font-medium text-amber-200">{joinMessage}</p>
            ) : null}
          </div>
        </div>
      ) : status === "waiting-for-user" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 px-4 text-center">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Live lesson ready</p>
            <button
              type="button"
              onClick={() => {
                const currentVideoElement = videoRef.current;
                if (!currentVideoElement) return;
                currentVideoElement.muted = false;
                const playbackToken = mediaPlaybackTokenRef.current;
                void currentVideoElement.play().then(() => {
                  if (playbackToken !== mediaPlaybackTokenRef.current) {
                    return;
                  }
                  setStatus("playing");
                  setDiagnostics((current) => ({ ...current, muted: currentVideoElement.muted }));
                }).catch((error) => {
                  const errorName = error instanceof Error ? error.name : "";

                  if (playbackToken !== mediaPlaybackTokenRef.current) {
                    logExpectedPlayInterruption(
                      "Stale manual playback rejection ignored",
                      error,
                    );
                    return;
                  }

                  if (errorName === "AbortError") {
                    logExpectedPlayInterruption(
                      "Manual Cloudflare WHEP playback was interrupted",
                      error,
                    );
                    return;
                  }

                  if (errorName === "NotAllowedError") {
                    logExpectedPlayInterruption(
                      "Manual Cloudflare WHEP playback still requires interaction",
                      error,
                    );
                    return;
                  }

                  console.warn("Manual Cloudflare WHEP playback start failed");
                  logUnexpectedErrorDetails("Manual WHEP playback diagnostic", error);
                });
              }}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Join Live Lesson
            </button>
          </div>
        </div>
      ) : status === "failed" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 px-4 text-center">
          <div className="max-w-sm space-y-4 rounded-[1.5rem] border border-white/15 bg-slate-950/75 p-6 shadow-lg backdrop-blur-sm">
            <div className="space-y-2">
              <p className="text-lg font-bold text-white">
                {failedReason === "connection-lost"
                  ? "Connection to the live lesson was lost."
                  : "Unable to connect to the live lesson."}
              </p>
              <p className="text-sm text-white/90">
                Check your connection and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTryAgain}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CloudflareWebRTCPlayer;