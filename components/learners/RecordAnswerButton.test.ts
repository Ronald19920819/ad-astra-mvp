import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" + browser MediaRecorder/getUserMedia usage -- cannot be
// rendered in a plain node:test run, matching this repo's established
// convention (see LessonAccessibilityAudioPlayer.test.ts's header
// comment for the original precedent). These assert structural
// properties of the real source directly.

const SOURCE = readFileSync("components/learners/RecordAnswerButton.tsx", "utf8");

test("this component performs no entitlement/submission check of its own -- it is rendered ONLY by a parent that already confirmed both server-side; it never decides visibility from a client-supplied flag", () => {
  assert.doesNotMatch(SOURCE, /accessibilityEnabled|accessibility_enabled|submission\./);
});

test("I: recording starts and stops only on an explicit learner action (button press) -- never automatically, never always-on", () => {
  assert.match(SOURCE, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(SOURCE, /function handlePress\(\) \{/);
  assert.doesNotMatch(SOURCE, /useEffect\(\(\) => \{\s*void startRecording/);
});

test("mic tracks are always released (stream.getTracks().forEach(track => track.stop())) on stop, abort, and unmount -- the microphone is never left active in the background", () => {
  assert.match(SOURCE, /function releaseStream\(\) \{/);
  assert.match(SOURCE, /streamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  const unmountEffect = SOURCE.match(/useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*?\n    \};/)?.[0];
  assert.ok(unmountEffect, "unmount cleanup effect not found");
  assert.match(unmountEffect!, /abortRecordingSession\(\);/);
});

test("a supported MIME type is chosen dynamically via the shared pure helper -- never a single hardcoded browser-specific format", () => {
  assert.match(SOURCE, /pickSupportedRecordingMimeType\(\(candidate\) =>\s*MediaRecorder\.isTypeSupported\(candidate\),?\s*\)/);
});

test("C: MediaRecorder support is feature-detected before use -- an unsupported browser gets a friendly message, never a thrown exception", () => {
  assert.match(SOURCE, /typeof window\.MediaRecorder === "undefined"/);
  assert.match(SOURCE, /const UNSUPPORTED_MESSAGE = "Recording is not supported in this browser\.";/);
});

test("W: a permission-denied getUserMedia rejection produces the exact friendly permission message, distinct from a generic failure", () => {
  assert.match(SOURCE, /const PERMISSION_DENIED_MESSAGE = "Microphone access is required to record an answer\.";/);
  assert.match(SOURCE, /error\.name === "NotAllowedError"/);
});

test("B: a missing-microphone rejection produces its own distinct friendly message", () => {
  assert.match(SOURCE, /const NO_MICROPHONE_MESSAGE = "No microphone was found on this device\.";/);
  assert.match(SOURCE, /error\.name === "NotFoundError"/);
});

test("D/V: a too-short or empty recording never reaches the network -- it resolves directly to the friendly no-speech message client-side", () => {
  assert.match(
    SOURCE,
    /import \{ MAX_RECORDING_SECONDS, MIN_RECORDING_MS \} from "@\/lib\/accessibility\/recordingLimits";/,
  );
  assert.match(SOURCE, /if \(elapsedMs < MIN_RECORDING_MS \|\| chunks\.length === 0\) \{/);
  const guardBlock = SOURCE.match(/if \(elapsedMs < MIN_RECORDING_MS \|\| chunks\.length === 0\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock);
  assert.doesNotMatch(guardBlock!, /fetch\(/);
});

test("U: a maximum recording duration is enforced (from the SAME shared limits module the server validates against) and auto-stops the recorder rather than allowing an indefinite recording", () => {
  assert.match(SOURCE, /reachedMaxDurationRef\.current = true;/);
  assert.match(SOURCE, /recorder\.stop\(\);/);
});

test("B: the client's own measured recording duration is sent to the server alongside the audio, so the server can run its plausibility check", () => {
  assert.match(SOURCE, /formData\.append\("recordingDurationSeconds", String\(elapsedMs \/ 1000\)\);/);
});

test("reaching the max duration still transcribes what was recorded (never silently discards) and informs the learner afterwards", () => {
  assert.match(SOURCE, /const wasMaxDuration = reachedMaxDurationRef\.current;/);
  assert.match(SOURCE, /setMaxDurationNoticeVisible\(wasMaxDuration\);/);
  assert.match(SOURCE, /const MAX_DURATION_NOTICE =/);
});

test("J: starting a new recording registers with the shared one-at-a-time controller, and being displaced by another recording returns this button to idle without an error", () => {
  assert.match(SOURCE, /registerActiveRecording\(token, abortRecordingSession, \(\) => \{/);
});

test("E: the recorded audio is uploaded to the ONE canonical transcription endpoint via multipart form data carrying activityId and questionId -- never a client-supplied learner/entitlement flag", () => {
  assert.match(SOURCE, /const TRANSCRIBE_ENDPOINT = "\/api\/accessibility\/transcribe-answer";/);
  assert.match(SOURCE, /formData\.append\("audio", blob,/);
  assert.match(SOURCE, /formData\.append\("activityId", activityId\);/);
  assert.match(SOURCE, /formData\.append\("questionId", questionId\);/);
  assert.doesNotMatch(SOURCE, /formData\.append\("(learnerId|accessibilityEnabled)"/);
});

test("K/L/M: on success, the raw transcript text is handed to the parent via onTranscript verbatim -- this component performs no merge/insert/append logic of its own", () => {
  assert.match(SOURCE, /onTranscript\(result\.text\);/);
  assert.doesNotMatch(SOURCE, /mergeTranscriptIntoAnswer|latestAnswersRef|writeLocalDraftCache|scheduleDraftSave/);
});

test("P: this component never calls a submit/mark endpoint -- it only ever calls the transcription endpoint", () => {
  assert.doesNotMatch(SOURCE, /mark-activity|activity-drafts/);
  const fetchCalls = SOURCE.match(/fetch\([^)]*\)/g) ?? [];
  assert.ok(fetchCalls.length > 0);
  for (const call of fetchCalls) {
    assert.match(call, /fetch\(TRANSCRIBE_ENDPOINT/);
  }
});

test("Q: no answer-enhancement/rewrite path exists in this component -- it displays exactly result.text, never a modified/summarised version", () => {
  assert.doesNotMatch(SOURCE, /rewrite|improve|enhance|correct|summar/i);
});

test("T/L: no raw audio Blob/File is ever stored persistently, downloaded, or played back locally -- no localStorage/indexedDB/Object URL usage anywhere; it exists only in memory for the duration of one fetch call", () => {
  assert.doesNotMatch(SOURCE, /localStorage|indexedDB|URL\.createObjectURL|URL\.revokeObjectURL/i);
});

test("N: on any failure the learner sees only a friendly message -- never raw error text, a file path, a model name, or a stack trace", () => {
  assert.doesNotMatch(SOURCE, /\{error\.message\}|\{err\.message\}|error\.stack/);
  assert.doesNotMatch(SOURCE, /gpt-4o|whisper/i);
});

test("recording status is visually obvious -- a distinct recording indicator and Stop control render only while status is 'recording'", () => {
  const recordingBranch = SOURCE.match(/if \(status === "recording"\) \{\s*\n\s*return \([\s\S]*?\n  \}/)?.[0];
  assert.ok(recordingBranch, "recording-state branch not found");
  assert.match(recordingBranch!, /Recording\.\.\./);
  assert.match(recordingBranch!, /Stop Recording/);
});

test("no VISUAL waveform UI or development-only debug controls exist in the production render -- this component has exactly two rendered branches (recording, and everything else), with no extra debug button", () => {
  assert.doesNotMatch(SOURCE, /<canvas/i);
  assert.doesNotMatch(SOURCE, /waveform/i);
  assert.doesNotMatch(SOURCE, /Debug|debugAudioUrl|STAGE_D_DIAGNOSTIC/);
});

test("K: STAGE E section 5 -- a production silent-microphone safeguard runs on every recording via a Web Audio AnalyserNode sampling the SAME MediaStream, using the shared pure decision helper", () => {
  assert.match(
    SOURCE,
    /import \{\s*isMicrophoneSignalAcceptable,\s*MICROPHONE_SIGNAL_THRESHOLD,\s*MICROPHONE_SILENCE_MESSAGE,\s*\} from "@\/lib\/accessibility\/microphoneSignal";/,
  );
  assert.match(SOURCE, /function startMicrophoneSignalMonitor\(stream: MediaStream\) \{/);
  assert.match(SOURCE, /function stopMicrophoneSignalMonitor\(\): boolean \{/);
  assert.match(SOURCE, /return isMicrophoneSignalAcceptable\(\{/);
  // Always runs -- not dev-gated, unlike the earlier throwaway diagnostic.
  assert.doesNotMatch(SOURCE, /if \(!?STAGE_D_DIAGNOSTIC_ENABLED\)/);
});

test("K: an unacceptable microphone signal blocks the upload entirely -- the transcription endpoint is never called, and the learner sees the exact required message", () => {
  const guardBlock = SOURCE.match(/if \(!micSignalAcceptable\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guardBlock, "silent-microphone guard block not found");
  assert.match(guardBlock!, /setErrorMessage\(MICROPHONE_SILENCE_MESSAGE\);/);
  assert.doesNotMatch(guardBlock!, /fetch\(/);

  // The guard runs BEFORE the fetch call in source order.
  const guardIndex = SOURCE.indexOf("if (!micSignalAcceptable)");
  const fetchIndex = SOURCE.indexOf("await fetch(TRANSCRIBE_ENDPOINT");
  assert.ok(guardIndex > -1 && fetchIndex > -1);
  assert.ok(guardIndex < fetchIndex);
});

test("the silent-microphone safeguard never plays the microphone back or records it -- source connects ONE WAY to the analyser, never onward to audioContext.destination", () => {
  assert.match(SOURCE, /source\.connect\(analyser\);/);
  assert.doesNotMatch(SOURCE, /connect\(audioContext\.destination\)/);
  assert.doesNotMatch(SOURCE, /analyser\.connect\(/);
});

test("mic-energy sampling is throttled (never per animation frame)", () => {
  assert.doesNotMatch(SOURCE, /requestAnimationFrame/);
  assert.match(SOURCE, /window\.setInterval\(\(\) => \{\s*analyser\.getFloatTimeDomainData\(buffer\);/);
});

test("a browser without Web Audio / AnalyserNode support fails OPEN (never blocks recording) rather than falsely rejecting every learner on that browser", () => {
  const noSupportBranch = SOURCE.match(/if \(typeof window === "undefined" \|\| typeof window\.AudioContext === "undefined"\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(noSupportBranch, "no-AudioContext-support branch not found");
  assert.match(noSupportBranch!, /micSignalDetectedRef\.current = true;/);
});

test("a monitor that throws on start also fails open rather than blocking the learner", () => {
  const catchBlock = SOURCE.match(/\} catch \{\s*\/\/ Fail open[\s\S]*?\n    \}/)?.[0];
  assert.ok(catchBlock, "fail-open catch block not found");
  assert.match(catchBlock!, /micSignalDetectedRef\.current = true;/);
});

test("the silent-microphone monitor is stopped and its AudioContext closed on normal finish and on abort, so it never leaks across recordings", () => {
  assert.match(SOURCE, /function abortRecordingSession\(\) \{\s*clearTimers\(\);\s*stopMicrophoneSignalMonitor\(\);/);
  assert.match(
    SOURCE,
    /async function finishRecording\(token: RecordingToken, mimeType: string\) \{\s*clearTimers\(\);\s*const elapsedMs = Date\.now\(\) - startedAtRef\.current;\s*const micSignalAcceptable = stopMicrophoneSignalMonitor\(\);/,
  );
  assert.match(SOURCE, /if \(audioContext\) void audioContext\.close\(\);/);
});

test("the disabled prop (activity submitted/locked, or textarea not editable) both hides interaction and force-aborts an in-progress recording without transcribing", () => {
  assert.match(SOURCE, /disabled\?: boolean;/);
  assert.match(SOURCE, /if \(disabled && status !== "idle"\) \{/);
  const disabledEffect = SOURCE.match(/if \(disabled && status !== "idle"\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(disabledEffect);
  assert.match(disabledEffect!, /abortRecordingSession\(\);/);
  assert.doesNotMatch(disabledEffect!, /finishRecording|onTranscript/);
});
