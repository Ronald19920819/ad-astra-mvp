import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiveKitViewerIdentity,
  isLiveKitLearnerViewerIdentity,
} from "./viewerIdentity";

const profileId = "5f119c26-f70e-47ac-8696-0f453069dda4";

test("builds a learner viewer identity", () => {
  assert.equal(
    buildLiveKitViewerIdentity("learner", profileId),
    `viewer-learner-${profileId}`,
  );
});

test("builds a teacher viewer identity", () => {
  assert.equal(
    buildLiveKitViewerIdentity("teacher", profileId),
    `viewer-teacher-${profileId}`,
  );
});

test("rejects a malformed profileId when building an identity", () => {
  assert.throws(() => buildLiveKitViewerIdentity("learner", "not-a-uuid"));
  assert.throws(() => buildLiveKitViewerIdentity("teacher", ""));
});

test("a real learner viewer identity passes validation", () => {
  assert.equal(
    isLiveKitLearnerViewerIdentity(`viewer-learner-${profileId}`),
    true,
  );
});

test("a teacher viewer identity is NOT a valid learner identity", () => {
  assert.equal(
    isLiveKitLearnerViewerIdentity(`viewer-teacher-${profileId}`),
    false,
  );
});

test("the OBS ingress participant identity is NOT a valid learner identity", () => {
  // ad-astra-obs-<subjectUuid>, from lib/livekit/subjectRoom.ts.
  assert.equal(
    isLiveKitLearnerViewerIdentity(
      "ad-astra-obs-c472f3c9-0e6f-40de-a748-3ad9400ac069",
    ),
    false,
  );
});

test("arbitrary/spoofed strings are rejected", () => {
  assert.equal(isLiveKitLearnerViewerIdentity("viewer-learner-"), false);
  assert.equal(isLiveKitLearnerViewerIdentity("viewer-learner-not-a-uuid"), false);
  assert.equal(isLiveKitLearnerViewerIdentity(""), false);
  assert.equal(
    isLiveKitLearnerViewerIdentity(`viewer-learner-${profileId}; DROP TABLE`),
    false,
  );
});
