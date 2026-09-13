import assert from "node:assert/strict";
import test from "node:test";
import { toSafeErrorDetails } from "./authDiagnostics";

// toSafeErrorDetails is a pure function (no next/headers, no
// "server-only") and is exercised directly. logAuthDiagnostic itself
// calls getDiagnosticRequestId() (next/headers-backed) and cannot be
// invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent; its shape is verified via source inspection in the
// consuming files' own test suites (teacherAuth.test.ts,
// teacherProfile.test.ts, learnerProfile.test.ts).

test("extracts only name/code/status/message from a real-shaped Supabase AuthError-like object", () => {
  const details = toSafeErrorDetails({
    name: "AuthApiError",
    code: "session_expired",
    status: 401,
    message: "JWT expired",
    // Anything else on the error object must never leak through.
    accessToken: "should-never-appear",
    stack: "should-never-appear",
  });

  assert.deepEqual(details, {
    name: "AuthApiError",
    code: "session_expired",
    status: 401,
    message: "JWT expired",
  });
});

test("tolerates a plain Postgres-style error object (code/message only, no name/status)", () => {
  const details = toSafeErrorDetails({ code: "PGRST116", message: "no rows" });
  assert.deepEqual(details, {
    name: undefined,
    code: "PGRST116",
    status: null,
    message: "no rows",
  });
});

test("returns undefined for a non-object/null error -- callers logging without an error object never crash", () => {
  assert.equal(toSafeErrorDetails(null), undefined);
  assert.equal(toSafeErrorDetails(undefined), undefined);
  assert.equal(toSafeErrorDetails("a string error"), undefined);
});

test("never coerces an unexpected field type into the output -- a non-string code/message or non-number status is dropped, not stringified", () => {
  const details = toSafeErrorDetails({ code: 500, status: "not-a-number", message: 12345 });
  assert.deepEqual(details, {
    name: undefined,
    code: null,
    status: null,
    message: undefined,
  });
});
