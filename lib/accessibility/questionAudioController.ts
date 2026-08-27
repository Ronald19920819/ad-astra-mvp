// A tiny page-level singleton so at most one "Listen to Question" clip
// ever plays at a time, across every question on the page (a quiz has
// several questions rendered at once; an activity workspace can too).
// Pressing Listen on a different question stops whatever was already
// playing before starting the new one -- see AD ASTRA ACCESSIBILITY
// STAGE C section 11. Deliberately NOT the same controller/model as
// LessonAccessibilityAudioPlayer.tsx's reading player: that player owns
// ONE long-form, seekable, persisted recording; this controller only
// ever needs to coordinate short, independent, non-seekable clips.

type ActiveAudio = {
  element: HTMLAudioElement;
  onStoppedByOther: () => void;
};

let active: ActiveAudio | null = null;

// Stops whichever question's audio is currently playing (if any) and
// notifies that question's own button so its UI can return to idle. Safe
// to call even when nothing is playing.
export function stopActiveQuestionAudio(): void {
  if (!active) return;
  const previous = active;
  active = null;
  previous.element.pause();
  previous.onStoppedByOther();
}

// Registers a newly-started <audio> element as the one playing question
// clip, stopping any previous one first. onStoppedByOther is called ONLY
// when THIS registration is displaced by a later one (or by an explicit
// stopActiveQuestionAudio() call) -- never when the audio element ends,
// errors, or is paused/resumed by its own button, since those are already
// handled by that button's own state.
export function registerActiveQuestionAudio(
  element: HTMLAudioElement,
  onStoppedByOther: () => void,
): void {
  if (active && active.element !== element) {
    stopActiveQuestionAudio();
  }
  active = { element, onStoppedByOther };
}

// Called by a question's own button when ITS audio naturally finishes,
// errors, or is paused by the learner -- clears the registration only if
// this element is still the one actually registered (a stale call from an
// already-displaced element must never clear a NEWER registration).
export function clearActiveQuestionAudioIfSelf(element: HTMLAudioElement): void {
  if (active?.element === element) {
    active = null;
  }
}
