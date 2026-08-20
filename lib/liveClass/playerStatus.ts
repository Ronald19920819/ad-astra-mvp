// Provider-neutral Live Classroom player status. Currently produced only by
// CloudflareWebRTCPlayer's WHEP connection state machine; a future LiveKit
// player is expected to produce values from this same union via its own
// onStatusChange callback, so callers (e.g. LiveClassroomWorkspace's status
// pill) need no changes when the media provider switches. Relocated out of
// CloudflareWebRTCPlayer.tsx verbatim -- values and wording are unchanged.
export type WebRTCStatus =
  | "offline"
  | "connecting"
  | "waiting-for-user"
  | "playing"
  | "reconnecting"
  | "ended"
  | "failed";

// Maps internal player status to learner/teacher-facing wording. Kept
// separate from any one player implementation so the connection-state
// machine stays fully decoupled from page-level copy/wording choices.
export function describeLiveClassroomStatus(status: WebRTCStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting to live lesson";
    case "offline":
      return "No live lesson in session";
    case "waiting-for-user":
      return "Live lesson ready";
    case "playing":
      return "Live now";
    case "reconnecting":
      return "Reconnecting";
    case "ended":
      return "Live lesson ended";
    case "failed":
      return "Connection problem";
    default:
      return "No live lesson in session";
  }
}
