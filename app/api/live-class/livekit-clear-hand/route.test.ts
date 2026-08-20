import assert from "node:assert/strict";
import test from "node:test";
import {
  isLiveKitLearnerParticipant,
} from "@/lib/liveClass/livekitAttendance";
import { getLiveKitRoomNameForSubject } from "@/lib/livekit/subjectRoom";
import { isLiveKitLearnerViewerIdentity } from "@/lib/livekit/viewerIdentity";
import {
  getSubjectConfigurationByDatabaseId,
  subjectConfigurations,
} from "@/lib/subjects/subjectConfig";

// This route (app/api/live-class/livekit-clear-hand/route.ts) transitively
// imports "server-only" (via lib/supabase/teacherAuth.ts and
// lib/livekit/serverConfig.ts), which has no real npm package in this repo
// and only resolves inside a Next.js server build/bundle -- so, matching
// the existing precedent in
// app/api/teacher/business-studies/reviews/[submissionId]/reading-pdf/route.test.ts
// and app/api/live-class/livekit-token/route.test.ts, the route handler
// itself cannot be invoked directly in a plain node:test run. Instead these
// tests exercise the real (unmodified, importable) validation predicates
// the route applies BEFORE ever calling a LiveKit server API:
//
//   1. subjectId validation: getSubjectConfigurationByDatabaseId(subjectId)
//   2. learner-identity shape validation: isLiveKitLearnerViewerIdentity
//   3. the room the mutation would be scoped to: getLiveKitRoomNameForSubject
//   4. the role check applied to whatever getParticipant() returns:
//      isLiveKitLearnerParticipant
//
// Teacher authorization itself ("teacher must be authenticated", "teacher
// must be authorized for the exact subject") is enforced entirely by the
// pre-existing, unmodified authorizeTeacher(subjectId) function, called by
// the route with the real dynamic subjectId -- its own subject-scoping
// behavior is unchanged by this route and is not re-tested here, matching
// the same precedent's treatment of teacher authorization elsewhere.
// "Target learner must belong to the same LiveKit room/subject" is enforced
// by RoomServiceClient.getParticipant itself being scoped to the resolved
// room name -- a LiveKit server API behavior, not something a plain
// node:test run can exercise without a live LiveKit project.

const businessStudies = subjectConfigurations["business-studies"];
const englishStage8 = subjectConfigurations["english-stage-8"];
const learnerIdentity = "viewer-learner-5f119c26-f70e-47ac-8696-0f453069dda4";
const teacherIdentity = "viewer-teacher-5f119c26-f70e-47ac-8696-0f453069dda4";
const obsIdentity = `ad-astra-obs-${businessStudies.databaseId}`;

test("a valid subjectId resolves to a real subject before anything else runs", () => {
  assert.ok(getSubjectConfigurationByDatabaseId(businessStudies.databaseId));
  assert.equal(getSubjectConfigurationByDatabaseId("not-a-real-uuid"), undefined);
});

test("only a well-formed learner viewer identity passes the pre-LiveKit-API check", () => {
  assert.equal(isLiveKitLearnerViewerIdentity(learnerIdentity), true);
  assert.equal(isLiveKitLearnerViewerIdentity(teacherIdentity), false);
  assert.equal(isLiveKitLearnerViewerIdentity(obsIdentity), false);
  assert.equal(isLiveKitLearnerViewerIdentity("arbitrary-string"), false);
});

test("the OBS ingress participant can never be targeted", () => {
  assert.equal(isLiveKitLearnerViewerIdentity(obsIdentity), false);
});

test("the mutation is always scoped to the exact requested subject's room", () => {
  const businessStudiesRoom = getLiveKitRoomNameForSubject(businessStudies.databaseId);
  const englishRoom = getLiveKitRoomNameForSubject(englishStage8.databaseId);
  assert.notEqual(businessStudiesRoom, englishRoom);
});

test("a fetched participant must have role learner before being mutated", () => {
  const learnerInfo = { identity: learnerIdentity, attributes: { role: "learner" } };
  const teacherInfo = { identity: teacherIdentity, attributes: { role: "teacher" } };
  assert.equal(isLiveKitLearnerParticipant(learnerInfo), true);
  assert.equal(isLiveKitLearnerParticipant(teacherInfo), false);
});
