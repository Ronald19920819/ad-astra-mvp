"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { pickSupportedRecordingMimeType } from "@/lib/accessibility/audioMimeType";
import {
  clearActiveRecordingIfSelf,
  registerActiveRecording,
  type RecordingToken,
} from "@/lib/accessibility/recordingController";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_MS } from "@/lib/accessibility/recordingLimits";
import {
  isMicrophoneSignalAcceptable,
  MICROPHONE_SIGNAL_THRESHOLD,
  MICROPHONE_SILENCE_MESSAGE,
} from "@/lib/accessibility/microphoneSignal";

type Status = "idle" | "requesting-permission" | "recording" | "transcribing" | "error";

const TRANSCRIBE_ENDPOINT = "/api/accessibility/transcribe-answer";

const GENERIC_ERROR_MESSAGE = "Your recording could not be transcribed. Please try again.";
const PERMISSION_DENIED_MESSAGE = "Microphone access is required to record an answer.";
const NO_MICROPHONE_MESSAGE = "No microphone was found on this device.";
const UNSUPPORTED_MESSAGE = "Recording is not supported in this browser.";
const EMPTY_SPEECH_MESSAGE = "No speech was detected. Please try again.";
const MAX_DURATION_NOTICE =
  "Recording stopped automatically after reaching the time limit.";

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function mimeTypeFileExtension(mimeType: string): string {
  return mimeType.split("/")[1]?.split(";")[0] ?? "webm";
}

// Stage D/E "Record Answer": speech-to-text into the EXISTING answer
// field (activities today; the same component is reused unchanged for
// any future formal-test answer field, since this platform has no
// separate test system -- see AD ASTRA ACCESSIBILITY STAGE E's Phase 1
// investigation). This component only ever captures audio, runs the
// pre-upload silence safeguard, uploads to the one canonical
// transcription endpoint, and hands the resulting text back via
// onTranscript -- it never touches answer state, autosave, or the
// paste/drop guards directly. The parent is solely responsible for
// merging the transcript through the SAME canonical answer-update path a
// keystroke uses; this component has no opinion on insert-vs-append.
//
// Rendered ONLY by a parent that has already confirmed (server-side)
// entitlement and that the answer target is not yet submitted/locked --
// the transcription endpoint independently re-verifies both on every
// request regardless.
export function RecordAnswerButton({
  activityId,
  questionId,
  onTranscript,
  disabled = false,
}: {
  activityId: string;
  questionId: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [maxDurationNoticeVisible, setMaxDurationNoticeVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tokenRef = useRef<RecordingToken>({});
  const startedAtRef = useRef(0);
  const elapsedIntervalRef = useRef<number | null>(null);
  const maxDurationTimeoutRef = useRef<number | null>(null);
  const reachedMaxDurationRef = useRef(false);

  // Production silent-microphone safeguard (AD ASTRA ACCESSIBILITY STAGE
  // E section 5): a Web Audio AnalyserNode samples the SAME MediaStream
  // handed to MediaRecorder, throttled to 4x/second (never per animation
  // frame). It is only ever read into numeric RMS/peak levels -- never
  // recorded, stored, or played back -- and is used solely to decide,
  // BEFORE uploading, whether the recording is worth sending at all. See
  // lib/accessibility/microphoneSignal.ts for the (pure, separately
  // tested) accept/reject decision itself.
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSampleIntervalRef = useRef<number | null>(null);
  const micPeakRef = useRef(0);
  const micSumRef = useRef(0);
  const micSampleCountRef = useRef(0);
  const micSignalDetectedRef = useRef(false);

  function clearTimers() {
    if (elapsedIntervalRef.current !== null) {
      window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current !== null) {
      window.clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function startMicrophoneSignalMonitor(stream: MediaStream) {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      // No Web Audio support: fail open rather than blocking every
      // recording on a browser that simply lacks AnalyserNode.
      micSignalDetectedRef.current = true;
      return;
    }

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      // Connected ONE WAY (source -> analyser only) -- never onward to
      // audioContext.destination, so this never plays the microphone
      // back through speakers and never records anything.
      source.connect(analyser);

      micAudioContextRef.current = audioContext;
      micPeakRef.current = 0;
      micSumRef.current = 0;
      micSampleCountRef.current = 0;
      micSignalDetectedRef.current = false;

      const buffer = new Float32Array(analyser.fftSize);
      micSampleIntervalRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        let sumSquares = 0;
        let peak = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const sample = buffer[i];
          sumSquares += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        micSumRef.current += rms;
        micSampleCountRef.current += 1;
        micPeakRef.current = Math.max(micPeakRef.current, peak);
        if (rms > MICROPHONE_SIGNAL_THRESHOLD) {
          micSignalDetectedRef.current = true;
        }
      }, 250);
    } catch {
      // Fail open: a monitor that couldn't start must never itself block
      // a learner's recording.
      micSignalDetectedRef.current = true;
    }
  }

  function stopMicrophoneSignalMonitor(): boolean {
    if (micSampleIntervalRef.current !== null) {
      window.clearInterval(micSampleIntervalRef.current);
      micSampleIntervalRef.current = null;
    }
    const audioContext = micAudioContextRef.current;
    micAudioContextRef.current = null;
    if (audioContext) void audioContext.close();

    return isMicrophoneSignalAcceptable({
      signalDetected: micSignalDetectedRef.current,
      peakLevel: micPeakRef.current,
      averageLevel: micSampleCountRef.current > 0 ? micSumRef.current / micSampleCountRef.current : 0,
    });
  }

  // Hard-abort: used when a DIFFERENT recording elsewhere on the page
  // displaces this one, or when this button becomes disabled mid-
  // recording (e.g. the answer target is being submitted). Never
  // transcribes -- onstop is detached first so the normal finish/upload
  // path cannot fire for a session we are deliberately abandoning.
  function abortRecordingSession() {
    clearTimers();
    stopMicrophoneSignalMonitor();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    releaseStream();
    mediaRecorderRef.current = null;
  }

  useEffect(() => {
    return () => {
      abortRecordingSession();
      clearActiveRecordingIfSelf(tokenRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This effect exists specifically to react to an external prop change
  // (the answer target becoming submitted/locked mid-recording) by
  // force-abandoning an in-progress recording -- there is no
  // user-event handler to move this into.
  useEffect(() => {
    if (disabled && status !== "idle") {
      abortRecordingSession();
      clearActiveRecordingIfSelf(tokenRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("idle");
      setElapsedSeconds(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  async function finishRecording(token: RecordingToken, mimeType: string) {
    clearTimers();
    const elapsedMs = Date.now() - startedAtRef.current;
    const micSignalAcceptable = stopMicrophoneSignalMonitor();
    releaseStream();
    clearActiveRecordingIfSelf(token);
    mediaRecorderRef.current = null;

    const wasMaxDuration = reachedMaxDurationRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];

    if (elapsedMs < MIN_RECORDING_MS || chunks.length === 0) {
      setStatus("error");
      setErrorMessage(EMPTY_SPEECH_MESSAGE);
      return;
    }

    // Production safeguard: if no meaningful microphone signal was ever
    // detected during the recording, never send it to OpenAI at all --
    // show the learner a friendly, specific message instead. This is
    // deliberately conservative (see microphoneSignal.ts) so a genuinely
    // quiet or slow-speaking learner is never falsely rejected.
    if (!micSignalAcceptable) {
      setStatus("error");
      setErrorMessage(MICROPHONE_SILENCE_MESSAGE);
      return;
    }

    setStatus("transcribing");

    try {
      const blob = new Blob(chunks, { type: mimeType });
      const formData = new FormData();
      formData.append("audio", blob, `recording.${mimeTypeFileExtension(mimeType)}`);
      formData.append("activityId", activityId);
      formData.append("questionId", questionId);
      // The client is the only place that genuinely knows how long the
      // learner actually spoke -- sent so the server can run a
      // conservative plausibility check (recording duration vs.
      // returned transcript length) and catch a provider silently
      // returning a drastically-too-short transcript for a long
      // recording. Never trusted for anything security-critical.
      formData.append("recordingDurationSeconds", String(elapsedMs / 1000));

      const response = await fetch(TRANSCRIBE_ENDPOINT, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || typeof result.text !== "string") {
        setStatus("error");
        setErrorMessage(result.error || GENERIC_ERROR_MESSAGE);
        return;
      }

      onTranscript(result.text);
      setStatus("idle");
      setElapsedSeconds(0);
      setMaxDurationNoticeVisible(wasMaxDuration);
    } catch {
      setStatus("error");
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  async function startRecording() {
    setErrorMessage("");
    setMaxDurationNoticeVisible(false);

    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setStatus("error");
      setErrorMessage(UNSUPPORTED_MESSAGE);
      return;
    }

    setStatus("requesting-permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setStatus("error");
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError")
      ) {
        setErrorMessage(PERMISSION_DENIED_MESSAGE);
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setErrorMessage(NO_MICROPHONE_MESSAGE);
      } else {
        setErrorMessage(GENERIC_ERROR_MESSAGE);
      }
      return;
    }

    startMicrophoneSignalMonitor(stream);

    const mimeType = pickSupportedRecordingMimeType((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    );
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    const token: RecordingToken = {};
    tokenRef.current = token;
    registerActiveRecording(token, abortRecordingSession, () => {
      // Displaced by a different recording elsewhere on the page.
      setStatus("idle");
      setElapsedSeconds(0);
    });

    chunksRef.current = [];
    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    reachedMaxDurationRef.current = false;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      void finishRecording(token, recorder.mimeType || mimeType || "audio/webm");
    });
    recorder.addEventListener("error", () => {
      clearTimers();
      stopMicrophoneSignalMonitor();
      releaseStream();
      clearActiveRecordingIfSelf(token);
      mediaRecorderRef.current = null;
      setStatus("error");
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    });

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    recorder.start();
    setStatus("recording");

    elapsedIntervalRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    maxDurationTimeoutRef.current = window.setTimeout(() => {
      reachedMaxDurationRef.current = true;
      if (mediaRecorderRef.current === recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    }, MAX_RECORDING_SECONDS * 1000);
  }

  function stopRecording() {
    clearTimers();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function handlePress() {
    if (disabled) return;
    if (status === "idle" || status === "error") {
      void startRecording();
    } else if (status === "recording") {
      stopRecording();
    }
    // requesting-permission / transcribing: ignore extra presses.
  }

  if (status === "recording") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
          Recording... {formatElapsed(elapsedSeconds)}
        </span>
        <button
          type="button"
          onClick={handlePress}
          aria-label="Stop recording"
          className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
        >
          <Square size={12} />
          Stop Recording
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handlePress}
        disabled={disabled || status === "requesting-permission" || status === "transcribing"}
        aria-label="Record Answer"
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"
      >
        <Mic size={14} />
        {status === "requesting-permission"
          ? "Starting..."
          : status === "transcribing"
            ? "Transcribing..."
            : "Record Answer"}
      </button>
      {status === "error" && (
        <span role="status" className="flex items-center gap-2 text-xs font-semibold text-red-700">
          {errorMessage || GENERIC_ERROR_MESSAGE}
          <button type="button" onClick={() => void startRecording()} className="underline">
            Try Again
          </button>
        </span>
      )}
      {maxDurationNoticeVisible && (
        <span role="status" className="text-xs font-semibold text-amber-700">
          {MAX_DURATION_NOTICE}
        </span>
      )}
    </div>
  );
}
