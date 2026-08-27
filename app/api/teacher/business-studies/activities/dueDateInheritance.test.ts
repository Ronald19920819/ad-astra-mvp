import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Both routes import "server-only" transitively and cannot be invoked
// directly in a plain node:test run (see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent). These assert the real source implements the LOCKED
// shared-due-date architecture: lesson owns it, activity derives it,
// never the other way around.

const createSource = readFileSync(
  "app/api/teacher/business-studies/activities/route.ts",
  "utf8",
);
const editSource = readFileSync(
  "app/api/teacher/business-studies/activities/[activityId]/route.ts",
  "utf8",
);

test("D/create: the create route validates the LINKED LESSON's own due date, never a client-supplied one", () => {
  assert.match(createSource, /validateRequiredDueDate\(\s*lesson\.expected_completion_date,?\s*\)/);
  assert.doesNotMatch(createSource, /validateRequiredDueDate\(dueDate\)/);
  assert.doesNotMatch(createSource, /payload\.dueDate/);
});

test("C/create: a lesson without a due date blocks activity publishing with a clear code", () => {
  assert.match(createSource, /code: "MISSING_LESSON_DUE_DATE"/);
});

test("create route never writes lessons.expected_completion_date -- the lesson is the source, never the target, of this derivation", () => {
  assert.doesNotMatch(createSource, /\.from\("lessons"\)\s*\.update/);
});

test("D/edit: the edit route validates the LINKED LESSON's own due date, never a client-supplied one", () => {
  assert.match(editSource, /validateRequiredDueDate\(\s*lesson\.expected_completion_date,?\s*\)/);
  assert.doesNotMatch(editSource, /validateRequiredDueDate\(dueDate\)/);
  assert.doesNotMatch(editSource, /payload\.dueDate/);
});

test("C/edit: a lesson without a due date blocks activity saving with a clear code", () => {
  assert.match(editSource, /code: "MISSING_LESSON_DUE_DATE"/);
});

test("edit route never writes lessons.expected_completion_date -- the lesson is the source, never the target, of this derivation", () => {
  assert.doesNotMatch(editSource, /\.from\("lessons"\)\s*\.update/);
});

test("both routes still write the derived date to activities.due_date, so existing readers (coinEarningEngine, learner UI) keep working unchanged", () => {
  assert.match(createSource, /due_date: dueDateValidation\.dueDate/);
  assert.match(editSource, /due_date: dueDateValidation\.dueDate|p_due_date: dueDateValidation\.dueDate/);
});
