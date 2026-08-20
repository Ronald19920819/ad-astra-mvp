import assert from "node:assert/strict";
import test from "node:test";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";
import { getLiveKitRoomNameForSubject } from "./subjectRoom";
import { buildLiveKitViewerGrant } from "./viewerGrant";

const businessStudies = subjectConfigurations["business-studies"];
const englishStage8 = subjectConfigurations["english-stage-8"];

test("viewer grant can never publish camera/microphone or data", () => {
  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.equal(grant.canPublish, false);
  assert.equal(grant.canPublishData, false);
});

test("viewer grant allows subscribing and joining", () => {
  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.equal(grant.canSubscribe, true);
  assert.equal(grant.roomJoin, true);
});

test("viewer grant's room is always the server-derived subject room, never client-chosen", () => {
  // buildLiveKitViewerGrant's only input is the (already-authorized)
  // subjectDatabaseId -- there is no room/roomName parameter it could
  // accept from a client, so its output room always matches the pure
  // deterministic derivation for that exact subject.
  for (const subject of [businessStudies, englishStage8]) {
    const grant = buildLiveKitViewerGrant(subject.databaseId);
    assert.equal(grant.room, getLiveKitRoomNameForSubject(subject.databaseId));
  }
});

test("viewer grants for different subjects never resolve to the same room", () => {
  const grantA = buildLiveKitViewerGrant(businessStudies.databaseId);
  const grantB = buildLiveKitViewerGrant(englishStage8.databaseId);
  assert.notEqual(grantA.room, grantB.room);
});

// A: learner (and every viewer) grant includes canUpdateOwnMetadata=true --
// required for LocalParticipant.setAttributes (raise/lower hand).
test("viewer grant permits updating own attributes via setAttributes", () => {
  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.equal(grant.canUpdateOwnMetadata, true);
});

// Regression guard: the grant must never mark viewers "hidden" -- that
// makes a participant invisible to useRemoteParticipants() for every other
// participant, which is what previously produced an empty teacher
// Attendance card even though learners were genuinely connected.
test("viewer participants are NOT hidden, so the teacher can see them in Attendance", () => {
  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.notEqual(grant.hidden, true);
});
