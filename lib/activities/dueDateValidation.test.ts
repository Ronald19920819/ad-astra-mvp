import assert from "node:assert/strict";
import test from "node:test";
import { validateRequiredDueDate } from "./dueDateValidation";

test("missing (undefined) due date is rejected", () => {
  const result = validateRequiredDueDate(undefined);
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "missing");
});

test("null due date is rejected", () => {
  const result = validateRequiredDueDate(null);
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "missing");
});

test("blank string due date is rejected -- typeof === 'string' is not enough", () => {
  const result = validateRequiredDueDate("");
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "blank");
});

test("whitespace-only due date is rejected", () => {
  const result = validateRequiredDueDate("   ");
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "blank");
});

test("malformed due date string is rejected", () => {
  const result = validateRequiredDueDate("14 August 2026");
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "invalid_format");
});

test("an impossible calendar date is rejected", () => {
  const result = validateRequiredDueDate("2026-13-40");
  assert.equal(result.valid, false);
});

test("a well-formed valid date is accepted", () => {
  const result = validateRequiredDueDate("2026-08-14");
  assert.equal(result.valid, true);
  assert.equal((result as { dueDate: string }).dueDate, "2026-08-14");
});

test("a valid date with surrounding whitespace is trimmed and accepted", () => {
  const result = validateRequiredDueDate("  2026-08-14  ");
  assert.equal(result.valid, true);
  assert.equal((result as { dueDate: string }).dueDate, "2026-08-14");
});

test("a non-string value (e.g. a number) is rejected", () => {
  const result = validateRequiredDueDate(20260814);
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, "missing");
});
