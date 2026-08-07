"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type CloudflareWebRTCPlayerProps = {
  whepUrl: string;
  onConnected?: () => void;
  onFailure?: () => void;
};

type WebRTCStatus =
  | "offline"
  | "connecting"
  | "waiting-for-user"
  | "playing"
  | "ended"
  | "failed";

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
}: CloudflareWebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionLocationRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const disconnectGraceTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  const attemptActiveRef = useRef(false);
  const hasLiveTrackRef = useRef(false);
  const isMountedRef = useRef(false);
  const onConnectedRef = useRef(onConnected);
  const onFailureRef = useRef(onFailure);
  const mediaPlaybackTokenRef = useRef(0);
  const silentRetryRef = useRef(false);

  const [status, setStatus] = useState<WebRTCStatus>("connecting");
  const [attemptNonce, setAttemptNonce] = useState(0);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    onFailureRef.current = onFailure;
  }, [onFailure]);



  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    playbackAttemptCounter += 1;
    const attemptId = playbackAttemptCounter;
    let isCancelled = false;
    const abortController = new AbortController();
    const videoElement = videoRef.current;

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

    const transitionToOffline = (reason: string, nextStatus: "offline" | "ended") => {
      invalidatePlaybackAttempt(`transition_to_${nextStatus}`);
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection(reason);
      hasLiveTrackRef.current = false;
      attemptActiveRef.current = false;

      if (isMountedRef.current && !isCancelled) {
        setStatus(nextStatus);
      }

      scheduleRetry(reason);
    };

    const reportFailure = (phase: FailurePhase, details?: unknown) => {
      if (isCancelled) return;

      invalidatePlaybackAttempt(`failure:${phase}`);
      clearAttemptTimeout();
      clearDisconnectGraceTimer();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection(`failure:${phase}`);
      hasLiveTrackRef.current = false;
      attemptActiveRef.current = false;

      if (isMountedRef.current) {
        setStatus("failed");
      }

      console.error("Cloudflare WHEP playback failed");
      console.error("WHEP attempt:", attemptId);
      console.error("WHEP phase:", phase);
      console.error("WHEP URL:", whepUrl);
      console.error("WHEP details:", stringifyDetails(details));
      logUnexpectedErrorDetails("WHEP diagnostic", details);

      onFailureRef.current?.();
    };

    if (IS_DEVELOPMENT) {
      console.info(`WHEP attempt ${attemptId}`);
      console.info("WHEP startPlayback started");
      console.info("WHEP URL:", whepUrl);
    }

    clearRetryTimer();
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
    if (isMountedRef.current && !isSilentRetry) {
      setStatus("connecting");
    }

    timeoutTimerRef.current = window.setTimeout(() => {
      if (!hasLiveTrackRef.current) {
        if (IS_DEVELOPMENT) {
          console.info("Offline WHEP check timed out; remaining offline.");
          console.info("WHEP attempt:", attemptId);
        }
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

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      if (videoElement) {
        videoElement.srcObject = remoteStream;
      }

      try {
        peerConnection.addTransceiver("audio", { direction: "recvonly" });
        peerConnection.addTransceiver("video", { direction: "recvonly" });
      } catch (error) {
        reportFailure("transceivers", error);
        return;
      }

      const handleTrackEnded = (kind: string) => {
        if (IS_DEVELOPMENT) {
          console.info(`Cloudflare WHEP ${kind} track ended`);
        }
        transitionToOffline(`track_ended_${kind}`, "ended");
      };

      peerConnection.addEventListener("track", (event) => {
        const incomingTracks = event.streams[0]?.getTracks() ?? [event.track];

        for (const track of incomingTracks) {
          if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
            remoteStream.addTrack(track);
          }

          track.onended = () => {
            handleTrackEnded(track.kind);
          };
        }

        hasLiveTrackRef.current = true;
        clearDisconnectGraceTimer();
        clearAttemptTimeout();

        if (!videoElement || isCancelled) {
          return;
        }

        const playbackToken = mediaPlaybackTokenRef.current;

        const playWithAudio = async () => {
          videoElement.muted = false;
          await videoElement.play();
        };

        const playMuted = async () => {
          videoElement.muted = true;
          await videoElement.play();
        };

        void playWithAudio()
          .then(() => {
            if (isCancelled || playbackToken !== mediaPlaybackTokenRef.current) {
              return;
            }
            attemptActiveRef.current = false;
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
        if (IS_DEVELOPMENT) {
          console.info("WHEP connection state:", peerConnection.connectionState);
        }

        if (peerConnection.connectionState === "connected") {
          clearDisconnectGraceTimer();
          return;
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "closed"
        ) {
          if (hasLiveTrackRef.current) {
            transitionToOffline(`connection_${peerConnection.connectionState}`, "ended");
            return;
          }

          reportFailure("connection-state", {
            connectionState: peerConnection.connectionState,
          });
          return;
        }

        if (peerConnection.connectionState === "disconnected") {
          clearDisconnectGraceTimer();
          disconnectGraceTimerRef.current = window.setTimeout(() => {
            if (
              !peerConnectionRef.current ||
              peerConnectionRef.current.connectionState !== "disconnected"
            ) {
              return;
            }

            if (hasLiveTrackRef.current) {
              transitionToOffline("connection_disconnected_grace_elapsed", "ended");
              return;
            }

            reportFailure("connection-state", {
              connectionState: peerConnection.connectionState,
            });
          }, DISCONNECT_GRACE_MS);
        }
      });

      peerConnection.addEventListener("iceconnectionstatechange", () => {
        if (IS_DEVELOPMENT) {
          console.info("WHEP ICE connection state:", peerConnection.iceConnectionState);
        }

        if (
          peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "completed"
        ) {
          clearDisconnectGraceTimer();
          return;
        }

        if (
          peerConnection.iceConnectionState === "failed" ||
          peerConnection.iceConnectionState === "closed"
        ) {
          if (hasLiveTrackRef.current) {
            transitionToOffline(`ice_${peerConnection.iceConnectionState}`, "ended");
            return;
          }

          reportFailure("ice-connection-state", {
            iceConnectionState: peerConnection.iceConnectionState,
          });
          return;
        }

        if (peerConnection.iceConnectionState === "disconnected") {
          clearDisconnectGraceTimer();
          disconnectGraceTimerRef.current = window.setTimeout(() => {
            if (
              !peerConnectionRef.current ||
              peerConnectionRef.current.iceConnectionState !== "disconnected"
            ) {
              return;
            }

            if (hasLiveTrackRef.current) {
              transitionToOffline("ice_disconnected_grace_elapsed", "ended");
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
      abortController.abort();
      cleanupSession();
      stopRemoteStream();
      clearVideoElement();
      closeExistingPeerConnection("component_unmount");
      attemptActiveRef.current = false;
      hasLiveTrackRef.current = false;
    };
  }, [attemptNonce, whepUrl]);

  const showOfflineImage =
    status === "offline" || status === "connecting" || status === "ended";

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {showOfflineImage ? (
        <Image
          src={OFFLINE_IMAGE_SRC}
          alt="Live Classroom currently offline"
          fill
          className="object-cover [object-position:42%_center]"
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

      {status === "waiting-for-user" ? (
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
      ) : null}
    </div>
  );
}

export default CloudflareWebRTCPlayer;