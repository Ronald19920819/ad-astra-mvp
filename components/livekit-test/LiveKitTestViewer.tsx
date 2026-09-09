"use client";

import {
  RoomAudioRenderer,
  useConnectionState,
  useRemoteParticipants,
  useStartAudio,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY } from "@/lib/livekit/testRoom";

// Isolated LiveKit media proof-of-concept only. Deliberately uses the
// official @livekit/components-react hooks/components for connection
// state, track subscription, and audio playback -- no manual
// RTCPeerConnection/ICE/SDP/reconnect logic, per the POC's purpose of
// evaluating LiveKit's managed client SDK.
type LearnerFacingStatus =
  | "connecting"
  | "waiting-for-teacher"
  | "live"
  | "reconnecting"
  | "problem";

function describeStatus(status: LearnerFacingStatus) {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "waiting-for-teacher":
      return "Waiting for teacher";
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting";
    case "problem":
      return "Connection problem";
    default:
      return "Connecting";
  }
}

export function LiveKitTestViewer() {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const microphoneTracks = useTracks([Track.Source.Microphone]);

  // The OBS ingress always publishes under this fixed participant
  // identity -- render specifically that participant's tracks rather than
  // treating any arbitrary remote participant as "the teacher".
  const obsParticipant = remoteParticipants.find(
    (participant) => participant.identity === LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY,
  );
  const obsVideoTrackRef = cameraTracks.find(
    (trackRef) => trackRef.participant.identity === LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY,
  );
  const obsAudioTrackRef = microphoneTracks.find(
    (trackRef) => trackRef.participant.identity === LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY,
  );

  const status: LearnerFacingStatus = (() => {
    if (connectionState === ConnectionState.Disconnected) return "problem";
    if (
      connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting
    ) {
      return "reconnecting";
    }
    if (connectionState === ConnectionState.Connecting) return "connecting";
    return obsParticipant && obsVideoTrackRef ? "live" : "waiting-for-teacher";
  })();

  // LiveKit's recommended pattern for browser autoplay restrictions: render
  // a user-initiated "start audio" control only when playback is actually
  // blocked, rather than treating the restriction as a stream failure.
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">Status</span>
        <span className="rounded-full bg-[#EEF7FF] px-3 py-1 text-xs font-bold text-[#1D4ED8]">
          {describeStatus(status)}
        </span>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] bg-slate-950">
        {obsVideoTrackRef ? (
          <VideoTrack
            trackRef={obsVideoTrackRef}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-medium text-white/70">
            {describeStatus(status)}
          </div>
        )}

        {!canPlayAudio ? (
          <button
            type="button"
            {...mergedProps}
            className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm"
          >
            Join Live Lesson / Enable Sound
          </button>
        ) : null}
      </div>

      {/* Official LiveKit component for rendering remote audio tracks --
          no custom audio-track/playback system. */}
      <RoomAudioRenderer />

      <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-blue-100 bg-white p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-500">Connection status</dt>
          <dd className="font-semibold text-slate-800">{describeStatus(status)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Teacher detected</dt>
          <dd className="font-semibold text-slate-800">{obsParticipant ? "Yes" : "Not yet"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Audio track</dt>
          <dd className="font-semibold text-slate-800">
            {obsAudioTrackRef ? "Detected" : "Not detected"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Video track</dt>
          <dd className="font-semibold text-slate-800">
            {obsVideoTrackRef ? "Detected" : "Not detected"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default LiveKitTestViewer;
