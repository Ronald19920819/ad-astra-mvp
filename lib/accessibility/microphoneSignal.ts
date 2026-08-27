// Production safeguard: Stage D manual testing found that Chrome can
// sometimes deliver an effectively silent MediaStream to MediaRecorder
// while it appears to record normally -- the resulting Blob decodes to
// near-silence (a click/snap only), and whisper-1 then returns a
// nonsensical short transcript that the plausibility safeguard
// (transcriptPlausibility.ts) correctly rejects, but only AFTER an
// unnecessary network round trip and OpenAI call.
//
// This module is the DECISION half of that safeguard: given a summary
// of the microphone's measured signal energy (produced by sampling a Web
// Audio AnalyserNode on the SAME MediaStream handed to MediaRecorder --
// see RecordAnswerButton.tsx), decide whether the recording is worth
// uploading at all. It never inspects audio content, never records or
// stores the audio, and is deliberately conservative: it only rejects
// when signal was NEVER detected across the whole recording, so a
// genuinely quiet or slow-speaking learner is never falsely blocked --
// see AD ASTRA ACCESSIBILITY STAGE E section 5's explicit requirement
// not to over-police naturally quiet learners.
export const MICROPHONE_SIGNAL_THRESHOLD = 0.02;

export const MICROPHONE_SILENCE_MESSAGE =
  "No clear microphone audio was detected. Please check your microphone and try again.";

export type MicrophoneSignalSummary = {
  // Whether measured RMS ever exceeded MICROPHONE_SIGNAL_THRESHOLD at
  // any point during the recording -- computed by the sampler, not here.
  signalDetected: boolean;
  peakLevel: number;
  averageLevel: number;
};

// Pure, deterministic: true means "upload this recording", false means
// "block the upload and show MICROPHONE_SILENCE_MESSAGE instead". Only
// ever consulted BEFORE the transcription request is sent -- never
// affects an already-uploaded recording, and never inspects duration or
// Blob size (those remain the separate, existing plausibility check that
// runs server-side AFTER transcription).
export function isMicrophoneSignalAcceptable(summary: MicrophoneSignalSummary): boolean {
  return summary.signalDetected;
}
