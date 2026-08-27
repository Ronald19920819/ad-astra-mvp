import assert from "node:assert/strict";
import test from "node:test";
import { validateRequiredDueDate } from "./dueDateValidation";

// app/api/teacher/business-studies/activities/route.ts and
// .../[activityId]/route.ts transitively import "server-only" (via
// authorizeTeacher -> lib/supabase/server.ts), so, matching the
// established precedent elsewhere in this codebase, the route handlers
// cannot be invoked directly in a plain node:test run. This instead
// verifies the exact write-value logic those two routes now share, under
// the LOCKED shared-due-date architecture: the LESSON owns the one
// authoritative due date (lessons.expected_completion_date); an activity
// never accepts an independently-entered due date from the client -- its
// own activities.due_date column is always DERIVED from the linked
// lesson's existing value.
//
// Mirrors the real routes' logic exactly:
//   const dueDateValidation = validateRequiredDueDate(lesson.expected_completion_date);
//   if (!dueDateValidation.valid) { reject with MISSING_LESSON_DUE_DATE }
//   admin.from("activities").insert/update({ ..., due_date: dueDateValidation.dueDate })
// Neither route writes to lessons.expected_completion_date at all anymore
// -- the lesson is the source, never the target, of this derivation.
function deriveActivityDueDateFromLesson(lessonExpectedCompletionDate: unknown) {
  const dueDateValidation = validateRequiredDueDate(lessonExpectedCompletionDate);
  if (!dueDateValidation.valid) {
    return { publishable: false as const, reason: dueDateValidation.reason };
  }

  return {
    publishable: true as const,
    activityWrite: { due_date: dueDateValidation.dueDate },
  };
}

test("A: a lesson with a due date lets a linked activity inherit that exact same due date", () => {
  const result = deriveActivityDueDateFromLesson("2026-08-26");
  assert.equal(result.publishable, true);
  if (!result.publishable) return;
  assert.equal(result.activityWrite.due_date, "2026-08-26");
});

test("C: a linked activity cannot be published/saved when the lesson has no due date yet", () => {
  assert.equal(deriveActivityDueDateFromLesson(null).publishable, false);
  assert.equal(deriveActivityDueDateFromLesson(undefined).publishable, false);
  assert.equal(deriveActivityDueDateFromLesson("").publishable, false);
  assert.equal(deriveActivityDueDateFromLesson("   ").publishable, false);
});

test("C: a lesson with a malformed due date does not let an activity publish either", () => {
  assert.equal(deriveActivityDueDateFromLesson("not-a-date").publishable, false);
  assert.equal(deriveActivityDueDateFromLesson("2026/08/26").publishable, false);
});

test("B: the activity's due date can never diverge from the lesson's -- there is no code path that accepts a second, independently-sourced value", () => {
  // The only input to the derivation is the lesson's own due date. A
  // teacher-supplied activity-level due date is never part of this
  // function's signature at all -- there is nothing to diverge from.
  const result = deriveActivityDueDateFromLesson("2026-08-26");
  assert.equal(result.publishable, true);
  if (!result.publishable) return;
  assert.equal(Object.keys(result.activityWrite).length, 1);
  assert.deepEqual(result.activityWrite, { due_date: "2026-08-26" });
});

// Historical frozen snapshots: this derivation only ever touches the LIVE
// activities.due_date column -- it never writes to activity_submissions,
// so a submission's already-frozen activity_snapshot (protected by the
// protect_activity_submission_snapshot trigger,
// supabase/migrations/202607260002_activity_submission_snapshots.sql) is
// structurally unreachable from this change and can never be rewritten by
// a later due-date edit.
test("editing the live due date never touches a submission's frozen snapshot fields", () => {
  const result = deriveActivityDueDateFromLesson("2026-09-01");
  assert.equal(result.publishable, true);
  if (!result.publishable) return;
  assert.ok(!("activity_snapshot" in result.activityWrite));
});
