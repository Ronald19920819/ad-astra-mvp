import assert from "node:assert/strict";
import test from "node:test";
import {
  getProfileInitials,
  resolveProfileIdentity,
} from "./profileIdentity";

test("profile identity prefers authenticated database names", () => {
  assert.deepEqual(
    resolveProfileIdentity({
      databaseFirstName: "Ethan",
      databaseSurname: "Petersen",
      databaseDisplayName: "Old Fixture",
      metadataDisplayName: "Metadata Fixture",
      email: "learner@example.com",
      roleFallback: "Learner",
    }),
    {
      firstName: "Ethan",
      surname: "Petersen",
      displayName: "Ethan Petersen",
    },
  );

  assert.equal(
    resolveProfileIdentity({
      email: "teacher@example.com",
      roleFallback: "Teacher",
    }).displayName,
    "teacher@example.com",
  );
});

test("shared avatar initials use names and neutral role fallbacks", () => {
  assert.equal(
    getProfileInitials(
      {
        firstName: "Test",
        surname: "Learner",
        displayName: "Test Learner",
      },
      "L",
    ),
    "TL",
  );
  assert.equal(getProfileInitials(null, "T"), "T");
});
