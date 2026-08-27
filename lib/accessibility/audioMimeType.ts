// Pure MIME-type selection for MediaRecorder-based microphone capture
// (Stage D "Record Answer"). Kept separate and pure so the fallback
// ORDER can be tested without a browser -- MediaRecorder.isTypeSupported
// itself is injected by the caller rather than referenced directly here.
//
// Preference order: Opus-in-WebM (Chrome/Edge desktop and Android) first
// since it is the smallest/most efficient for speech, then plain WebM,
// then MP4/AAC (Safari desktop and iOS, which do not support WebM at
// all), then undefined -- meaning "let the browser pick its own
// default", which MediaRecorder always accepts.
export const RECORDING_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
] as const;

export function pickSupportedRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | undefined {
  for (const candidate of RECORDING_MIME_TYPE_CANDIDATES) {
    if (isTypeSupported(candidate)) return candidate;
  }
  return undefined;
}

// OpenAI's transcription API partly infers the audio container from the
// uploaded filename's extension, so the server gives the in-memory
// recording a real extension matching its actual MIME type rather than a
// generic name -- never guessing a single hardcoded format.
export function mimeTypeToFileExtension(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
      return "mp4";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/wave":
      return "wav";
    default:
      return "webm";
  }
}
