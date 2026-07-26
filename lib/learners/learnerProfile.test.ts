import assert from "node:assert/strict";
import test from "node:test";
import {
  getLearnerInitials,
  splitLearnerDisplayName,
} from "./learnerProfile";

test("learner display names expose first name and surname", () => {
  assert.deepEqual(splitLearnerDisplayName("Ethan Petersen"), {
    firstName: "Ethan",
    surname: "Petersen",
  });
  assert.deepEqual(splitLearnerDisplayName("  Ada  van der Merwe "), {
    firstName: "Ada",
    surname: "van der Merwe",
  });
});

test("learner avatar initials have a neutral fallback", () => {
  assert.equal(
    getLearnerInitials({
      firstName: "Ethan",
      surname: "Petersen",
      displayName: "Ethan Petersen",
    }),
    "EP",
  );
  assert.equal(getLearnerInitials(null), "L");
});
