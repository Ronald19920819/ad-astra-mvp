"use client";

import Image from "next/image";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useStartAudio,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { ConnectionState, ParticipantEvent, Track } from "livekit-client";
import "@livekit/components-styles";
import type { LearnerPresenceInfo } from "@/components/subjects/LiveClassChatPanel";
import {
  LIVEKIT_RAISED_HAND_ATTRIBUTE,
  buildLearnerRosterFromLiveKitParticipants,
  resolveHandRaisedFromAttributeChange,
} from "@/lib/liveClass/livekitAttendance";
import { deriveLiveKitClassroomStatus } from "@/lib/liveClass/livekitStatusMapping";
import type { WebRTCStatus } from "@/lib/liveClass/playerStatus";
import { getLiveKitIngressParticipantIdentity } from "@/lib/livekit/subjectRoom";

// Production LiveKit media engine for the Live Classroom, reusing the
// architecture proven by components/livekit-test/LiveKitTestViewer.tsx:
// official LiveKitRoom/VideoTrack/RoomAudioRenderer/useStartAudio, no manual
// RTCPeerConnection/ICE/SDP/WHEP/reconnect logic -- LiveKit's client SDK
// owns transport and recovery entirely. This component is provider-specific
// on purpose: no Cloudflare/WHEP logic lives here, and CloudflareWebRTCPlayer
// is not imported or modified by it.
//
// Attendance and raised-hand state, for this provider, are derived from and
// stored on LiveKit room participants -- not Supabase Presence (see
// lib/liveClass/livekitAttendance.ts) -- since a participant genuinely
// connected to this exact subject's LiveKit room IS the live classroom.
const OFFLINE_IMAGE_SRC = "/live/currently-offline.png";

export type LiveKitClassroomPlayerHandle = {
  raiseHand: () => void;
  lowerHand: () => void;
  clearLearnerHand: (learnerIdentity: string) => void;
};

type LiveKitClassroomPlayerProps = {
  subjectDatabaseId: string;
  role: "teacher" | "learner";
  requireExplicitAudioJoin?: boolean;
  onStatusChange?: (status: WebRTCStatus) => void;
  onPresenceChange?: (learners: LearnerPresenceInfo[]) => void;
  onOwnHandRaisedChange?: (raised: boolean) => void;
};

type ConnectionDetails = {
  token: string;
  url: string;
};

export const LiveKitClassroomPlayer = forwardRef<
  LiveKitClassroomPlayerHandle,
  LiveKitClassroomPlayerProps
>(function LiveKitClassroomPlayer(
  {
    subjectDatabaseId,
    role,
    requireExplicitAudioJoin = false,
    onStatusChange,
    onPresenceChange,
    onOwnHandRaisedChange,
  },
  ref,
) {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(
    null,
  );
  const [tokenFetchFailed, setTokenFetchFailed] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const onPresenceChangeRef = useRef(onPresenceChange);
  useEffect(() => {
    onPresenceChangeRef.current = onPresenceChange;
  }, [onPresenceChange]);

  const onOwnHandRaisedChangeRef = useRef(onOwnHandRaisedChange);
  useEffect(() => {
    onOwnHandRaisedChangeRef.current = onOwnHandRaisedChange;
  }, [onOwnHandRaisedChange]);

  useEffect(() => {
    onOwnHandRaisedChangeRef.current?.(isHandRaised);
  }, [isHandRaised]);

  useImperativeHandle(
    ref,
    () => ({
      raiseHand: () => {
        if (role !== "learner") return;
        setIsHandRaised(true);
      },
      lowerHand: () => {
        if (role !== "learner") return;
        setIsHandRaised(false);
      },
      clearLearnerHand: (learnerIdentity: string) => {
        void fetch("/api/live-class/livekit-clear-hand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ subjectId: subjectDatabaseId, learnerIdentity }),
        }).catch((error) => {
          console.error("Unable to clear learner's raised hand:", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
        });
      },
    }),
    [role, subjectDatabaseId],
  );

  useEffect(() => {
    let cancelled = false;
    // One controller per effect run: React Strict Mode's synthetic
    // mount->cleanup->remount in development would otherwise let the first
    // (discarded) run's request complete anyway, producing two real POSTs
    // to the token endpoint. Aborting on cleanup means the synthetic first
    // run's request is cancelled instead of silently finishing.
    const controller = new AbortController();

    queueMicrotask(() => {
      if (cancelled) return;
      setConnectionDetails(null);
      setTokenFetchFailed(false);
      onStatusChangeRef.current?.("connecting");
    });

    async function fetchToken() {
      try {
        // Only the exact subject UUID is sent -- no room name, no OBS
        // identity, no client-asserted role. Those are all derived
        // server-side from this verified subjectId (Stage 1).
        const response = await fetch("/api/live-class/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ subjectId: subjectDatabaseId }),
          signal: controller.signal,
        });

        const result = (await response.json().catch(() => null)) as
          | { token?: string; url?: string }
          | null;

        if (!response.ok || !result?.token || !result?.url) {
          throw new Error("Unable to obtain a Live Classroom connection.");
        }

        if (!cancelled) {
          setConnectionDetails({ token: result.token, url: result.url });
        }
      } catch (error) {
        // A cleanup-triggered abort (Strict Mode's synthetic first run, or
        // a real unmount/subjectDatabaseId change mid-fetch) is expected
        // teardown, not a failed connection -- it must never surface as
        // "failed" to the user.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!cancelled) {
          console.error("Unable to fetch LiveKit Live Classroom token:", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
          setTokenFetchFailed(true);
          onStatusChangeRef.current?.("failed");
        }
      }
    }

    void fetchToken();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [subjectDatabaseId, retryAttempt]);

  if (tokenFetchFailed) {
    return (
      <div className="relative h-full w-full bg-black">
        <Image
          src={OFFLINE_IMAGE_SRC}
          alt="Live Classroom currently offline"
          fill
          className="bg-black object-contain object-center opacity-0"
          sizes="(max-width: 1024px) 100vw, 70vw"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 px-4 text-center">
          <div className="max-w-sm space-y-4 rounded-[1.5rem] border border-white/15 bg-slate-950/75 p-6 shadow-lg backdrop-blur-sm">
            <div className="space-y-2">
              <p className="text-lg font-bold text-white">
                Unable to connect to the live lesson.
              </p>
              <p className="text-sm text-white/90">
                Check your connection and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRetryAttempt((current) => current + 1)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!connectionDetails) {
    return (
      <div className="relative h-full w-full bg-black">
        <Image
          src={OFFLINE_IMAGE_SRC}
          alt="Live Classroom currently offline"
          fill
          className="bg-black object-contain object-center"
          sizes="(max-width: 1024px) 100vw, 70vw"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 px-4 text-center text-sm font-medium text-white">
          Connecting to the live stream...
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connectionDetails.url}
      token={connectionDetails.token}
      connect
      audio={false}
      video={false}
      className="h-full w-full"
    >
      <LiveKitClassroomPlayerContent
        subjectDatabaseId={subjectDatabaseId}
        role={role}
        requireExplicitAudioJoin={requireExplicitAudioJoin}
        isHandRaised={isHandRaised}
        onStatusChangeRef={onStatusChangeRef}
        onPresenceChangeRef={onPresenceChangeRef}
        onServerHandRaisedChange={setIsHandRaised}
      />
    </LiveKitRoom>
  );
});

function LiveKitClassroomPlayerContent({
  subjectDatabaseId,
  role,
  requireExplicitAudioJoin,
  isHandRaised,
  onStatusChangeRef,
  onPresenceChangeRef,
  onServerHandRaisedChange,
}: {
  subjectDatabaseId: string;
  role: "teacher" | "learner";
  requireExplicitAudioJoin: boolean;
  isHandRaised: boolean;
  onStatusChangeRef: React.RefObject<((status: WebRTCStatus) => void) | undefined>;
  onPresenceChangeRef: React.RefObject<
    ((learners: LearnerPresenceInfo[]) => void) | undefined
  >;
  onServerHandRaisedChange: (raised: boolean) => void;
}) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();

  // The OBS ingress for THIS exact subject always publishes under this
  // deterministic identity (Stage 1) -- render specifically that
  // participant, never "first remote participant". This is what keeps
  // simultaneous teachers in different subjects fully isolated: a learner
  // in this room can never end up rendering another subject's stream,
  // because no other subject's OBS participant identity can ever match.
  const obsParticipantIdentity = useMemo(
    () => getLiveKitIngressParticipantIdentity(subjectDatabaseId),
    [subjectDatabaseId],
  );

  const obsParticipant = remoteParticipants.find(
    (participant) => participant.identity === obsParticipantIdentity,
  );
  const obsVideoTrackRef = cameraTracks.find(
    (trackRef) => trackRef.participant.identity === obsParticipantIdentity,
  );

  // LiveKit's recommended pattern for browser autoplay restrictions: only
  // ever surfaced as a user-gesture control, never as a stream failure.
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });

  const status = deriveLiveKitClassroomStatus({
    connectionState,
    hasObsParticipant: Boolean(obsParticipant),
    hasObsVideoTrack: Boolean(obsVideoTrackRef),
    canPlayAudio,
  });

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status, onStatusChangeRef]);

  // Sync this learner's own raised-hand state onto their LiveKit
  // participant attributes -- LocalParticipant.setAttributes is the
  // officially supported mechanism for a participant to update its OWN
  // small synchronized state, broadcast to every other participant in the
  // room. Re-applied whenever isHandRaised changes AND whenever the
  // connection (re)establishes, so a mid-session reconnect reproduces
  // whatever value the (stable, outer-component-owned) isHandRaised state
  // actually holds rather than silently losing it.
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    void localParticipant
      .setAttributes({ [LIVEKIT_RAISED_HAND_ATTRIBUTE]: String(isHandRaised) })
      .catch((error) => {
        console.error("Unable to sync raised-hand state to LiveKit:", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      });
  }, [isHandRaised, connectionState, localParticipant]);

  // Reconcile the outer isHandRaised state DOWNWARD when this learner's
  // OWN raisedHand attribute changes from a source other than the effect
  // above -- specifically, a teacher's clear-hand action, which updates it
  // server-side via RoomServiceClient.updateParticipant and is broadcast
  // back to the learner's own client. Without this, the Raise Hand button
  // stays stuck showing "raised" after being cleared, and the next time
  // the push effect above re-runs (e.g. a reconnect), it would silently
  // re-assert the stale `true` value back onto LiveKit, undoing the
  // teacher's clear. Harmless no-op when the change is just the local echo
  // of this learner's own setAttributes call, since the value already
  // matches (React bails out on an identical state update).
  useEffect(() => {
    if (role !== "learner") return;

    function handleAttributesChanged(changedAttributes: Record<string, string>) {
      const resolved = resolveHandRaisedFromAttributeChange(changedAttributes);
      if (resolved !== null) onServerHandRaisedChange(resolved);
    }

    localParticipant.on(ParticipantEvent.AttributesChanged, handleAttributesChanged);
    return () => {
      localParticipant.off(ParticipantEvent.AttributesChanged, handleAttributesChanged);
    };
  }, [role, localParticipant, onServerHandRaisedChange]);

  // Learner attendance roster, authoritative for this provider: derived
  // directly from LiveKit room participants (filtered to role === "learner"
  // via lib/liveClass/livekitAttendance.ts), not Supabase Presence. Only
  // notified when the roster's actual content changes, to avoid re-render
  // churn on every unrelated room event.
  const learnerRoster = useMemo(
    () => buildLearnerRosterFromLiveKitParticipants(remoteParticipants),
    [remoteParticipants],
  );
  const previousRosterSignatureRef = useRef("");
  useEffect(() => {
    const signature = JSON.stringify(learnerRoster);
    if (signature === previousRosterSignatureRef.current) return;
    previousRosterSignatureRef.current = signature;
    onPresenceChangeRef.current?.(learnerRoster);
  }, [learnerRoster, onPresenceChangeRef]);

  const showOfflinePlaceholder = !obsVideoTrackRef;
  const showJoinOverlay = Boolean(
    !canPlayAudio && obsVideoTrackRef && requireExplicitAudioJoin,
  );
  const showInlineEnableSound = Boolean(
    !canPlayAudio && obsVideoTrackRef && !requireExplicitAudioJoin,
  );

  return (
    <div className="relative h-full w-full bg-black">
      {showOfflinePlaceholder ? (
        <Image
          src={OFFLINE_IMAGE_SRC}
          alt="Live Classroom currently offline"
          fill
          className="bg-black object-contain object-center"
          sizes="(max-width: 1024px) 100vw, 70vw"
          priority
        />
      ) : (
        <VideoTrack trackRef={obsVideoTrackRef} className="h-full w-full object-contain" />
      )}

      {/* Official LiveKit component for rendering remote audio tracks --
          no custom audio-track/playback system. */}
      <RoomAudioRenderer />

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
              {...mergedProps}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Join Live Lesson
            </button>
          </div>
        </div>
      ) : null}

      {showInlineEnableSound ? (
        <div className="absolute inset-0 flex items-end justify-center bg-slate-950/10 px-4 pb-4">
          <button
            type="button"
            {...mergedProps}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm"
          >
            Enable Sound
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default LiveKitClassroomPlayer;
