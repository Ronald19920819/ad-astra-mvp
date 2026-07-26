import assert from "node:assert/strict";
import test from "node:test";
import { getAuthenticatedPasswordResetEmail } from "./passwordReset";

test("password reset uses only the authenticated verified email", () => {
  assert.equal(
    getAuthenticatedPasswordResetEmail({
      email: " learner@example.com ",
      emailConfirmedAt: "2026-07-26T10:00:00.000Z",
    }),
    "learner@example.com",
  );
  assert.equal(
    getAuthenticatedPasswordResetEmail({
      email: "unverified@example.com",
      emailConfirmedAt: null,
    }),
    null,
  );
});
