import assert from "node:assert/strict";
import test from "node:test";
import { countDistinctActiveLearners } from "./teacherProfile";

test("teacher overview counts a learner only once across assigned subjects", () => {
  assert.equal(
    countDistinctActiveLearners([
      "learner-one",
      "learner-two",
      "learner-one",
    ]),
    2,
  );
});
