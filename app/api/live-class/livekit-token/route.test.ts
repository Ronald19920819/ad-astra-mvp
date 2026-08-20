import assert from "node:assert/strict";
import test from "node:test";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";
import { getLiveKitRoomNameForSubject } from "@/lib/livekit/subjectRoom";
import { buildLiveKitViewerGrant } from "@/lib/livekit/viewerGrant";

// This route (app/api/live-class/livekit-token/route.ts) transitively
// imports "server-only" (via lib/supabase/subjectAccess.ts,
// lib/supabase/teacherAuth.ts, lib/livekit/serverConfig.ts, etc.), which has
// no real npm package in this repo and only resolves inside a Next.js
// server build/bundle -- so, matching the existing precedent in
// app/api/teacher/business-studies/reviews/[submissionId]/reading-pdf/route.test.ts,
// the route handler itself cannot be invoked directly in a plain node:test
// run. Instead these tests exercise:
//
//   1. buildLiveKitViewerGrant, the real (unmodified, importable) function
//      the route calls to build every token's grant -- see
//      lib/livekit/viewerGrant.test.ts for its own dedicated coverage.
//   2. the learner authorization predicate the route relies on, mirrored
//      verbatim from lib/supabase/subjectAccess.ts's
//      verifyLearnerSubjectAccessForProfile (which cannot be imported here
//      for the same "server-only" reason):
//
//        const subject = getSubjectConfigurationByDatabaseId(subjectId);
//        if (!subject) return { allowed: false, reason: "invalid-subject" };
//        const hasSubjectAccess = profile.approvedSubjects.some(
//          (approvedSubject) => approvedSubject.id === subjectId,
//        );
//        if (!hasSubjectAccess) return { allowed: false, reason: "subject-not-enrolled" };
//        return { allowed: true, ... };
//
// Teacher authorization ("teacher without exact assignment is rejected",
// "teacher with assignment receives a token") is enforced entirely by the
// pre-existing, unmodified authorizeTeacher(subjectId) function, called by
// the route with the real dynamic subjectId -- its own subject-scoping
// behavior is unchanged by this route and is not re-tested here, matching
// the same precedent's treatment of its own case G.
//
// "Unauthenticated request rejected" and "response contains no secret/key"
// are structural properties of the route's code (verified by direct
// inspection, cited below) rather than something a plain node:test run can
// exercise without a live Supabase session and Next.js request context,
// which this repo's test architecture does not currently provide:
//   - every early-return in route.ts happens strictly BEFORE
//     getLiveKitServerConfig()/AccessToken construction, so no token can be
//     minted for an unauthorized or unauthenticated caller;
//   - the only two Response.json({ ... }) shapes that carry LiveKit output
//     are `{ token, url }` (issueViewerToken) and `{ error }` /
//     `{ error, status }` -- config.apiKey, config.apiSecret, and
//     config.apiUrl are never referenced in any Response.json call.

type MirroredLearnerProfile = {
  learnerProfileId: string;
  approvedSubjects: { id: string }[];
};

function mirroredVerifyLearnerSubjectAccessForProfile(
  profile: MirroredLearnerProfile,
  subjectId: string,
) {
  const subject = Object.values(subjectConfigurations).find(
    (s) => s.databaseId === subjectId,
  );
  if (!subject) return { allowed: false as const, reason: "invalid-subject" as const };

  const hasSubjectAccess = profile.approvedSubjects.some(
    (approvedSubject) => approvedSubject.id === subjectId,
  );

  if (!hasSubjectAccess) {
    return { allowed: false as const, reason: "subject-not-enrolled" as const };
  }

  return {
    allowed: true as const,
    learnerProfileId: profile.learnerProfileId,
    subjectKey: subject.key,
  };
}

const businessStudies = subjectConfigurations["business-studies"];
const englishStage8 = subjectConfigurations["english-stage-8"];

test("learner with exact subject access is allowed and gets that exact subject's room", () => {
  const profile: MirroredLearnerProfile = {
    learnerProfileId: "learner-1",
    approvedSubjects: [{ id: businessStudies.databaseId }],
  };

  const access = mirroredVerifyLearnerSubjectAccessForProfile(
    profile,
    businessStudies.databaseId,
  );
  assert.equal(access.allowed, true);

  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.equal(grant.room, getLiveKitRoomNameForSubject(businessStudies.databaseId));
});

test("learner without exact subject access is rejected even if enrolled elsewhere", () => {
  const profile: MirroredLearnerProfile = {
    learnerProfileId: "learner-1",
    approvedSubjects: [{ id: englishStage8.databaseId }],
  };

  const access = mirroredVerifyLearnerSubjectAccessForProfile(
    profile,
    businessStudies.databaseId,
  );
  assert.equal(access.allowed, false);
});

test("a learner cannot gain access to a subject by requesting an invalid subjectId", () => {
  const profile: MirroredLearnerProfile = {
    learnerProfileId: "learner-1",
    approvedSubjects: [{ id: businessStudies.databaseId }],
  };

  const access = mirroredVerifyLearnerSubjectAccessForProfile(profile, "not-a-real-uuid");
  assert.equal(access.allowed, false);
});

test("issued grants never allow publish, matching the route's viewer-only design", () => {
  const grant = buildLiveKitViewerGrant(businessStudies.databaseId);
  assert.equal(grant.canPublish, false);
  assert.equal(grant.canPublishData, false);
});
