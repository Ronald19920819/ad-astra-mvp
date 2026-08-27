// Single source of truth for Stage D ("Record Answer") recording
// duration limits -- shared by the client (RecordAnswerButton.tsx, which
// auto-stops at this limit) and the server (the transcribe-answer route,
// which validates the client-reported duration against it). Never
// duplicate this number in a second place.
export const MAX_RECORDING_SECONDS = 180;

// Guards against a near-instant Stop press (or a mic that produced no
// usable audio) ever reaching the network at all.
export const MIN_RECORDING_MS = 300;
