import assert from "node:assert/strict";
import test from "node:test";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";
import {
  getLiveKitIngressParticipantIdentity,
  getLiveKitRoomNameForSubject,
} from "./subjectRoom";

const englishStage9 = subjectConfigurations["english"];
const englishStage8 = subjectConfigurations["english-stage-8"];
const afrikaansStage9 = subjectConfigurations["afrikaans"];
const afrikaansStage8 = subjectConfigurations["afrikaans-stage-8"];
const businessStudiesCanonical = subjectConfigurations["business-studies"];
const businessStudiesIgcse1 = subjectConfigurations["business-studies-igcse-1"];
const historyCanonical = subjectConfigurations["history"];
const historyIgcse1 = subjectConfigurations["history-igcse-1"];

test("English Stage 8 room differs from English Stage 9 room", () => {
  assert.notEqual(
    getLiveKitRoomNameForSubject(englishStage8.databaseId),
    getLiveKitRoomNameForSubject(englishStage9.databaseId),
  );
});

test("Afrikaans Grade 8 room differs from Grade 9 room", () => {
  assert.notEqual(
    getLiveKitRoomNameForSubject(afrikaansStage8.databaseId),
    getLiveKitRoomNameForSubject(afrikaansStage9.databaseId),
  );
});

test("Business Studies variants have different rooms", () => {
  assert.notEqual(
    getLiveKitRoomNameForSubject(businessStudiesCanonical.databaseId),
    getLiveKitRoomNameForSubject(businessStudiesIgcse1.databaseId),
  );
});

test("History variants have different rooms", () => {
  assert.notEqual(
    getLiveKitRoomNameForSubject(historyCanonical.databaseId),
    getLiveKitRoomNameForSubject(historyIgcse1.databaseId),
  );
});

test("the same subject UUID always returns the same room (determinism)", () => {
  const first = getLiveKitRoomNameForSubject(englishStage9.databaseId);
  const second = getLiveKitRoomNameForSubject(englishStage9.databaseId);
  assert.equal(first, second);
});

test("room name is derived from the exact UUID, not the subject key/family", () => {
  const room = getLiveKitRoomNameForSubject(englishStage9.databaseId);
  assert.ok(room.includes(englishStage9.databaseId.toLowerCase()));
  assert.ok(!room.includes(englishStage9.key));
  assert.ok(!room.includes(englishStage9.familyKey));
});

test("OBS ingress participant identity is deterministic and differs per subject", () => {
  const first = getLiveKitIngressParticipantIdentity(businessStudiesCanonical.databaseId);
  const second = getLiveKitIngressParticipantIdentity(businessStudiesCanonical.databaseId);
  assert.equal(first, second);
  assert.notEqual(
    first,
    getLiveKitIngressParticipantIdentity(businessStudiesIgcse1.databaseId),
  );
});

test("no two configured subjects accidentally share a room or OBS identity", () => {
  const allSubjects = Object.values(subjectConfigurations);

  const rooms = allSubjects.map((subject) =>
    getLiveKitRoomNameForSubject(subject.databaseId),
  );
  const identities = allSubjects.map((subject) =>
    getLiveKitIngressParticipantIdentity(subject.databaseId),
  );

  assert.equal(new Set(rooms).size, allSubjects.length);
  assert.equal(new Set(identities).size, allSubjects.length);
});

test("an invalid subject UUID is rejected rather than silently accepted", () => {
  assert.throws(() => getLiveKitRoomNameForSubject("not-a-real-uuid"));
  assert.throws(() => getLiveKitRoomNameForSubject(""));
  assert.throws(() => getLiveKitIngressParticipantIdentity("also-not-a-uuid"));
});

test("UUID casing does not create a second distinct room for the same subject", () => {
  const lower = getLiveKitRoomNameForSubject(englishStage9.databaseId.toLowerCase());
  const upper = getLiveKitRoomNameForSubject(englishStage9.databaseId.toUpperCase());
  assert.equal(lower, upper);
});
