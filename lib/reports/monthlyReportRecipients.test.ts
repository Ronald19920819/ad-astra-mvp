import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAndValidateRecipients, MAX_CC_RECIPIENTS } from "./monthlyReportRecipients";

test("accepts a valid main recipient with no CC recipients", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: [],
  });
  assert.deepEqual(result, {
    success: true,
    recipients: { mainRecipient: "learner@example.com", ccRecipients: [] },
  });
});

test("trims whitespace from the main recipient and CC recipients", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "  learner@example.com  ",
    ccRecipients: ["  parent@example.com  "],
  });
  assert.equal(result.success, true);
  assert.deepEqual(
    result.success ? result.recipients : null,
    { mainRecipient: "learner@example.com", ccRecipients: ["parent@example.com"] },
  );
});

test("rejects a missing main recipient", () => {
  const result = normalizeAndValidateRecipients({ mainRecipient: "", ccRecipients: [] });
  assert.equal(result.success, false);
});

test("rejects a malformed main recipient email", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "not-an-email",
    ccRecipients: [],
  });
  assert.equal(result.success, false);
});

test("rejects a malformed CC recipient email", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: ["not-an-email"],
  });
  assert.equal(result.success, false);
});

test("silently skips blank CC entries rather than rejecting the request", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: ["  ", "parent@example.com"],
  });
  assert.equal(result.success, true);
  assert.deepEqual(
    result.success ? result.recipients.ccRecipients : null,
    ["parent@example.com"],
  );
});

test("excludes the main recipient from CC (case-insensitively) rather than rejecting", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: ["LEARNER@example.com", "parent@example.com"],
  });
  assert.equal(result.success, true);
  assert.deepEqual(
    result.success ? result.recipients.ccRecipients : null,
    ["parent@example.com"],
  );
});

test("deduplicates CC recipients case-insensitively", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: ["parent@example.com", "Parent@Example.com"],
  });
  assert.equal(result.success, true);
  assert.deepEqual(
    result.success ? result.recipients.ccRecipients : null,
    ["parent@example.com"],
  );
});

test("rejects when CC recipients exceed the maximum allowed count", () => {
  const ccRecipients = Array.from({ length: MAX_CC_RECIPIENTS + 1 }, (_, i) => `cc${i}@example.com`);
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients,
  });
  assert.equal(result.success, false);
});

test("accepts exactly the maximum allowed CC recipient count", () => {
  const ccRecipients = Array.from({ length: MAX_CC_RECIPIENTS }, (_, i) => `cc${i}@example.com`);
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients,
  });
  assert.equal(result.success, true);
});

test("rejects a non-string main recipient", () => {
  const result = normalizeAndValidateRecipients({ mainRecipient: 123, ccRecipients: [] });
  assert.equal(result.success, false);
});

test("rejects a non-array ccRecipients value", () => {
  const result = normalizeAndValidateRecipients({
    mainRecipient: "learner@example.com",
    ccRecipients: "parent@example.com",
  });
  assert.equal(result.success, false);
});
