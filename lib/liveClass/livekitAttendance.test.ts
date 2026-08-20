import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVEKIT_RAISED_HAND_ATTRIBUTE,
  LIVEKIT_ROLE_ATTRIBUTE,
  buildLearnerRosterFromLiveKitParticipants,
  buildLiveKitViewerAttributes,
  isLiveKitLearnerParticipant,
  isLiveKitParticipantHandRaised,
  mapLiveKitParticipantToLearnerPresence,
  resolveHandRaisedFromAttributeChange,
} from "./livekitAttendance";

function participant(overrides: {
  identity: string;
  name?: string;
  attributes?: Record<string, string>;
}) {
  return overrides;
}

test("buildLiveKitViewerAttributes sets role + a well-defined initial raisedHand for learners", () => {
  const attrs = buildLiveKitViewerAttributes("learner");
  assert.equal(attrs[LIVEKIT_ROLE_ATTRIBUTE], "learner");
  assert.equal(attrs[LIVEKIT_RAISED_HAND_ATTRIBUTE], "false");
});

test("buildLiveKitViewerAttributes for teachers sets only role", () => {
  const attrs = buildLiveKitViewerAttributes("teacher");
  assert.equal(attrs[LIVEKIT_ROLE_ATTRIBUTE], "teacher");
  assert.equal(LIVEKIT_RAISED_HAND_ATTRIBUTE in attrs, false);
});

// --- Participant role filtering ---

test("a learner participant is recognized as a learner", () => {
  const learner = participant({
    identity: "viewer-learner-1",
    attributes: { role: "learner" },
  });
  assert.equal(isLiveKitLearnerParticipant(learner), true);
});

test("a teacher participant is NOT recognized as a learner", () => {
  const teacher = participant({
    identity: "viewer-teacher-1",
    attributes: { role: "teacher" },
  });
  assert.equal(isLiveKitLearnerParticipant(teacher), false);
});

test("the OBS ingress participant (no role attribute at all) is NOT a learner", () => {
  const obs = participant({
    identity: "ad-astra-obs-c472f3c9-0e6f-40de-a748-3ad9400ac069",
    attributes: undefined,
  });
  assert.equal(isLiveKitLearnerParticipant(obs), false);
});

test("a participant with attributes but no role is NOT a learner", () => {
  const noRole = participant({ identity: "mystery", attributes: {} });
  assert.equal(isLiveKitLearnerParticipant(noRole), false);
});

// --- Raised-hand state mapping ---

test("raisedHand attribute of exactly 'true' is raised", () => {
  const raised = participant({
    identity: "viewer-learner-1",
    attributes: { role: "learner", raisedHand: "true" },
  });
  assert.equal(isLiveKitParticipantHandRaised(raised), true);
});

test("raisedHand attribute of 'false' or missing is not raised", () => {
  const lowered = participant({
    identity: "viewer-learner-1",
    attributes: { role: "learner", raisedHand: "false" },
  });
  const missing = participant({
    identity: "viewer-learner-2",
    attributes: { role: "learner" },
  });
  assert.equal(isLiveKitParticipantHandRaised(lowered), false);
  assert.equal(isLiveKitParticipantHandRaised(missing), false);
});

// --- Attendance/roster mapping ---

test("attendance roster includes only learner participants", () => {
  const participants = [
    participant({ identity: "viewer-teacher-t1", name: "Ms Adams", attributes: { role: "teacher" } }),
    participant({
      identity: "ad-astra-obs-c472f3c9-0e6f-40de-a748-3ad9400ac069",
      name: "AD Astra Teacher",
    }),
    participant({
      identity: "viewer-learner-l1",
      name: "Ethan Petersen",
      attributes: { role: "learner", raisedHand: "false" },
    }),
    participant({
      identity: "viewer-learner-l2",
      name: "Mia Jacobs",
      attributes: { role: "learner", raisedHand: "true" },
    }),
  ];

  const roster = buildLearnerRosterFromLiveKitParticipants(participants);

  assert.equal(roster.length, 2);
  assert.deepEqual(
    roster.map((learner) => learner.displayName).sort(),
    ["Ethan Petersen", "Mia Jacobs"],
  );
});

test("one learner joining then a second joining is reflected in count", () => {
  const one = buildLearnerRosterFromLiveKitParticipants([
    participant({ identity: "viewer-learner-a", name: "A", attributes: { role: "learner" } }),
  ]);
  assert.equal(one.length, 1);

  const two = buildLearnerRosterFromLiveKitParticipants([
    participant({ identity: "viewer-learner-a", name: "A", attributes: { role: "learner" } }),
    participant({ identity: "viewer-learner-b", name: "B", attributes: { role: "learner" } }),
  ]);
  assert.equal(two.length, 2);
});

test("multiple raised hands coexist independently in the roster", () => {
  const roster = buildLearnerRosterFromLiveKitParticipants([
    participant({
      identity: "viewer-learner-a",
      name: "A",
      attributes: { role: "learner", raisedHand: "true" },
    }),
    participant({
      identity: "viewer-learner-b",
      name: "B",
      attributes: { role: "learner", raisedHand: "true" },
    }),
    participant({
      identity: "viewer-learner-c",
      name: "C",
      attributes: { role: "learner", raisedHand: "false" },
    }),
  ]);

  const raisedNames = roster.filter((l) => l.raisedHand).map((l) => l.displayName);
  assert.deepEqual(raisedNames.sort(), ["A", "B"]);
  assert.equal(roster.find((l) => l.displayName === "C")?.raisedHand, false);
});

test("a learner disappearing from the participant list is removed from the roster", () => {
  const withBoth = buildLearnerRosterFromLiveKitParticipants([
    participant({ identity: "viewer-learner-a", name: "A", attributes: { role: "learner" } }),
    participant({ identity: "viewer-learner-b", name: "B", attributes: { role: "learner" } }),
  ]);
  assert.equal(withBoth.length, 2);

  const afterDisconnect = buildLearnerRosterFromLiveKitParticipants([
    participant({ identity: "viewer-learner-b", name: "B", attributes: { role: "learner" } }),
  ]);
  assert.equal(afterDisconnect.length, 1);
  assert.equal(afterDisconnect[0].displayName, "B");
});

test("mapLiveKitParticipantToLearnerPresence falls back to identity when name is blank", () => {
  const info = mapLiveKitParticipantToLearnerPresence(
    participant({ identity: "viewer-learner-x", name: "  ", attributes: { role: "learner" } }),
  );
  assert.equal(info.displayName, "viewer-learner-x");
  assert.equal(info.profileId, "viewer-learner-x");
});

// H. two learners raised -> clearing one (server sets that learner's
// raisedHand attribute to "false") leaves the other unaffected.
test("clearing one learner's raised hand leaves the other learner's raised hand intact", () => {
  const beforeClear = buildLearnerRosterFromLiveKitParticipants([
    participant({
      identity: "viewer-learner-a",
      name: "A",
      attributes: { role: "learner", raisedHand: "true" },
    }),
    participant({
      identity: "viewer-learner-b",
      name: "B",
      attributes: { role: "learner", raisedHand: "true" },
    }),
  ]);
  assert.equal(beforeClear.find((l) => l.displayName === "A")?.raisedHand, true);
  assert.equal(beforeClear.find((l) => l.displayName === "B")?.raisedHand, true);

  // Simulates the teacher clear-hand endpoint's
  // RoomServiceClient.updateParticipant(roomName, "viewer-learner-a", {
  // attributes: { raisedHand: "false" } }) being reflected in the next
  // room participant snapshot.
  const afterClearingA = buildLearnerRosterFromLiveKitParticipants([
    participant({
      identity: "viewer-learner-a",
      name: "A",
      attributes: { role: "learner", raisedHand: "false" },
    }),
    participant({
      identity: "viewer-learner-b",
      name: "B",
      attributes: { role: "learner", raisedHand: "true" },
    }),
  ]);
  assert.equal(afterClearingA.find((l) => l.displayName === "A")?.raisedHand, false);
  assert.equal(afterClearingA.find((l) => l.displayName === "B")?.raisedHand, true);
});

// G. reconciling a learner's own outer raised-hand state from a LiveKit
// `attributesChanged` event -- the mechanism LiveKitClassroomPlayer.tsx
// uses so a teacher's clear-hand action can't be silently overwritten by a
// stale local `true` on the next reconnect/push.
test("resolveHandRaisedFromAttributeChange reads the new raisedHand value when it changed", () => {
  assert.equal(resolveHandRaisedFromAttributeChange({ raisedHand: "false" }), false);
  assert.equal(resolveHandRaisedFromAttributeChange({ raisedHand: "true" }), true);
});

test("resolveHandRaisedFromAttributeChange returns null when raisedHand was not part of the change", () => {
  assert.equal(resolveHandRaisedFromAttributeChange({ someOtherKey: "x" }), null);
  assert.equal(resolveHandRaisedFromAttributeChange({}), null);
});
