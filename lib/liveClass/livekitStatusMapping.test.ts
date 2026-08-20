import assert from "node:assert/strict";
import test from "node:test";
import { deriveLiveKitClassroomStatus } from "./livekitStatusMapping";

const base = {
  connectionState: "connected",
  hasObsParticipant: true,
  hasObsVideoTrack: true,
  canPlayAudio: true,
};

test("connecting maps to connecting", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "connecting" }),
    "connecting",
  );
});

test("connected with no OBS participant maps to offline", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({
      ...base,
      hasObsParticipant: false,
      hasObsVideoTrack: false,
    }),
    "offline",
  );
});

test("connected with OBS participant but no video track yet also maps to offline", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({
      ...base,
      hasObsParticipant: true,
      hasObsVideoTrack: false,
    }),
    "offline",
  );
});

test("OBS video available and audio playable maps to playing", () => {
  assert.equal(deriveLiveKitClassroomStatus(base), "playing");
});

test("autoplay blocked (video present, audio needs a gesture) maps to waiting-for-user", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, canPlayAudio: false }),
    "waiting-for-user",
  );
});

test("reconnecting maps to reconnecting", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "reconnecting" }),
    "reconnecting",
  );
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "signalReconnecting" }),
    "reconnecting",
  );
});

test("unexpected disconnect maps to failed", () => {
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "disconnected" }),
    "failed",
  );
});

test("connection-state transitions take priority over OBS/audio state", () => {
  // Even with a healthy OBS video track, an active reconnect or disconnect
  // must still surface as reconnecting/failed, not playing.
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "reconnecting" }),
    "reconnecting",
  );
  assert.equal(
    deriveLiveKitClassroomStatus({ ...base, connectionState: "disconnected" }),
    "failed",
  );
});
