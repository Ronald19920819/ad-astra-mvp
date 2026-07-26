import assert from "node:assert/strict";
import test from "node:test";
import {
  approvalTransition,
  canReviewLearnerRequest,
} from "./learnerApprovals";

test("an active assigned teacher can review only the requested subject", () => {
  assert.equal(
    canReviewLearnerRequest({
      authenticatedRole: "teacher",
      teacherIsActive: true,
      assignedSubjectIds: ["business-studies"],
      requestedSubjectId: "business-studies",
    }),
    true,
  );
  assert.equal(
    canReviewLearnerRequest({
      authenticatedRole: "teacher",
      teacherIsActive: true,
      assignedSubjectIds: ["history"],
      requestedSubjectId: "business-studies",
    }),
    false,
  );
});

test("a learner cannot approve their own request", () => {
  assert.equal(
    canReviewLearnerRequest({
      authenticatedRole: "learner",
      teacherIsActive: false,
      assignedSubjectIds: ["business-studies"],
      requestedSubjectId: "business-studies",
    }),
    false,
  );
});

test("approval unlocks the request and decline leaves it inactive", () => {
  assert.deepEqual(approvalTransition("approve"), {
    status: "approved",
    is_active: true,
  });
  assert.deepEqual(approvalTransition("decline"), {
    status: "declined",
    is_active: false,
  });
});
