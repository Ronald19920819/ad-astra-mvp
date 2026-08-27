// A tiny page-level singleton so at most one microphone recording is ever
// active at a time (Stage D "Record Answer") -- mirrors
// lib/accessibility/questionAudioController.ts's register/stop pattern
// exactly, applied to a MediaRecorder session instead of an <audio>
// element. Only one activity question is ever rendered at a time on this
// page today, but this still guards against a future layout change (or
// any other bug) ever allowing two microphones to be active
// concurrently.
//
// Identity is an opaque token object (created once per recording session
// by the caller), not the stop/callback functions themselves -- comparing
// function references would be fragile if a caller ever passed a
// freshly-created closure on a later call for what is logically the same
// session.

export type RecordingToken = object;

type ActiveRecording = {
  token: RecordingToken;
  stop: () => void;
  onStoppedByOther: () => void;
};

let active: ActiveRecording | null = null;

// Stops whichever recording is currently active (if any) and notifies
// its owning button so its UI can return to idle. Safe to call even when
// nothing is recording.
export function stopActiveRecording(): void {
  if (!active) return;
  const previous = active;
  active = null;
  previous.stop();
  previous.onStoppedByOther();
}

// Registers a newly-started recording session under a fresh token,
// stopping any previous one first. onStoppedByOther fires ONLY when this
// registration is later displaced by a different one (or by an explicit
// stopActiveRecording() call) -- never when the recording ends normally
// via its own Stop button, since that path already updates its own state
// directly.
export function registerActiveRecording(
  token: RecordingToken,
  stop: () => void,
  onStoppedByOther: () => void,
): void {
  if (active && active.token !== token) {
    stopActiveRecording();
  }
  active = { token, stop, onStoppedByOther };
}

// Called by a recording's own button when it stops itself (Stop pressed,
// max duration reached, or an error) -- clears the registration only if
// this token is still the one actually registered, so a stale call from
// an already-displaced session never clears a newer one.
export function clearActiveRecordingIfSelf(token: RecordingToken): void {
  if (active?.token === token) {
    active = null;
  }
}
