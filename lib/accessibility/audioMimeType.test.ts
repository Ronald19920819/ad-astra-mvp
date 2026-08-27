import assert from "node:assert/strict";
import test from "node:test";
import {
  mimeTypeToFileExtension,
  pickSupportedRecordingMimeType,
  RECORDING_MIME_TYPE_CANDIDATES,
} from "./audioMimeType";

test("prefers Opus-in-WebM when the browser supports it (Chrome/Edge desktop, Android Chromium)", () => {
  const result = pickSupportedRecordingMimeType((mimeType) => mimeType === "audio/webm;codecs=opus" || mimeType === "audio/webm");
  assert.equal(result, "audio/webm;codecs=opus");
});

test("falls back to plain WebM when Opus codec support cannot be confirmed but WebM itself can", () => {
  const result = pickSupportedRecordingMimeType((mimeType) => mimeType === "audio/webm");
  assert.equal(result, "audio/webm");
});

test("falls back to MP4/AAC on browsers with no WebM support at all (Safari desktop and iOS)", () => {
  const result = pickSupportedRecordingMimeType((mimeType) => mimeType === "audio/mp4");
  assert.equal(result, "audio/mp4");
});

test("falls back to mpeg as a last named candidate before giving up", () => {
  const result = pickSupportedRecordingMimeType((mimeType) => mimeType === "audio/mpeg");
  assert.equal(result, "audio/mpeg");
});

test("returns undefined (let the browser choose its own default) when nothing in the candidate list is supported", () => {
  const result = pickSupportedRecordingMimeType(() => false);
  assert.equal(result, undefined);
});

test("mimeTypeToFileExtension maps each real candidate MIME type to its matching file extension", () => {
  assert.equal(mimeTypeToFileExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(mimeTypeToFileExtension("audio/webm"), "webm");
  assert.equal(mimeTypeToFileExtension("audio/mp4"), "mp4");
  assert.equal(mimeTypeToFileExtension("audio/mpeg"), "mp3");
});

test("mimeTypeToFileExtension falls back to webm for an unrecognised MIME type rather than throwing", () => {
  assert.equal(mimeTypeToFileExtension("audio/x-totally-unknown"), "webm");
});

test("never hardcodes a single browser-specific format -- multiple real candidates are tried in order", () => {
  assert.ok(RECORDING_MIME_TYPE_CANDIDATES.length > 1);
  assert.deepEqual(RECORDING_MIME_TYPE_CANDIDATES, [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ]);
});
