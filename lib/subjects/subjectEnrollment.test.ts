import assert from "node:assert/strict";
import test from "node:test";
import { learnerSubjectGrantsAccess } from "./subjectEnrollment";

test("only approved active enrolments unlock subject access", () => {
  assert.equal(learnerSubjectGrantsAccess("approved", true), true);
  assert.equal(learnerSubjectGrantsAccess("approved", false), false);
  assert.equal(learnerSubjectGrantsAccess("pending", true), false);
  assert.equal(learnerSubjectGrantsAccess("declined", true), false);
});
