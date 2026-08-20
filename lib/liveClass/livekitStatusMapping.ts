import type { WebRTCStatus } from "@/lib/liveClass/playerStatus";

// Pure LiveKit -> provider-neutral status mapping, deliberately separated
// from LiveKitClassroomPlayer.tsx (a "use client" component that imports
// livekit-client/@livekit/components-react, real browser-oriented runtime
// code that can't be loaded under plain node:test) so this decision logic
// stays independently testable. `connectionState` is typed as `string`
// rather than importing livekit-client's ConnectionState enum here --
// livekit-client's string enum values ("disconnected" | "connecting" |
// "connected" | "reconnecting" | "signalReconnecting") are freely assignable
// to `string`, so callers can pass the real enum value directly with no
// cast, while this module stays free of any LiveKit runtime dependency.
export function deriveLiveKitClassroomStatus(input: {
  connectionState: string;
  hasObsParticipant: boolean;
  hasObsVideoTrack: boolean;
  canPlayAudio: boolean;
}): WebRTCStatus {
  if (input.connectionState === "disconnected") return "failed";

  if (
    input.connectionState === "reconnecting" ||
    input.connectionState === "signalReconnecting"
  ) {
    return "reconnecting";
  }

  if (input.connectionState === "connecting") return "connecting";

  if (!input.hasObsParticipant || !input.hasObsVideoTrack) return "offline";

  return input.canPlayAudio ? "playing" : "waiting-for-user";
}
