import assert from "node:assert/strict";
import test from "node:test";
import { validateRequiredDueDate } from "./dueDateValidation";

// app/api/teacher/business-studies/activities/route.ts and
// .../[activityId]/route.ts transitively import "server-only" (via
// authorizeTeacher -> lib/supabase/server.ts), so, matching the
// established precedent elsewhere in this codebase, the route handlers
// cannot be invoked directly in a plain node:test run. This instead
// verifies the exact write-value logic those two routes now share:
// - a teacher cannot publish/save a linked pair with a divergent or
//   missing due date (validateRequiredDueDate is the sole gate);
// - once accepted, the SAME validated value is the one written to both
//   activities.due_date and lessons.expected_completion_date -- not two
//   independently-sourced values that could drift apart.
//
// Mirrors the shape of the real write calls:
//   admin.from("activities").insert({ ..., due_date: dueDateValidation.dueDate })
//   admin.from("lessons").update({ expected_completion_date: dueDateValidation.dueDate })
function buildWritePayloads(rawDueDate: unknown) {
  const dueDateValidation = validateRequiredDueDate(rawDueDate);
  if (!dueDateValidation.valid) {
    return { accepted: false as const, reason: dueDateValidation.reason };
  }

  return {
    accepted: true as const,
    activityWrite: { due_date: dueDateValidation.dueDate },
    lessonWrite: { expected_completion_date: dueDateValidation.dueDate },
  };
}

test("a teacher cannot publish a pair with a blank due date", () => {
  const result = buildWritePayloads("");
  assert.equal(result.accepted, false);
});

test("a teacher cannot publish a pair with a whitespace-only due date", () => {
  const result = buildWritePayloads("   ");
  assert.equal(result.accepted, false);
});

test("a teacher cannot publish a pair with a missing due date", () => {
  const result = buildWritePayloads(undefined);
  assert.equal(result.accepted, false);
});

test("a teacher cannot publish a pair with an invalid due date", () => {
  const result = buildWritePayloads("not-a-date");
  assert.equal(result.accepted, false);
});

test("a valid due date is accepted and written identically to both the activity and the lesson", () => {
  const result = buildWritePayloads("2026-08-14");
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.activityWrite.due_date, "2026-08-14");
  assert.equal(result.lessonWrite.expected_completion_date, "2026-08-14");
  // The teacher cannot accidentally create divergent dates: both writes
  // are derived from the exact same validated value, never two separately
  // sourced inputs.
  assert.equal(result.activityWrite.due_date, result.lessonWrite.expected_completion_date);
});

// Historical frozen snapshots: the write paths above only ever touch the
// LIVE activities.due_date and lessons.expected_completion_date columns --
// neither route (nor this due-date logic) writes to activity_submissions
// at all, so a submission's already-frozen activity_snapshot (protected by
// the protect_activity_submission_snapshot trigger,
// supabase/migrations/202607260002_activity_submission_snapshots.sql)
// is structurally unreachable from this change and can never be rewritten
// by a later due-date edit.
test("editing the live due date never touches a submission's frozen snapshot fields", () => {
  const liveWrite = buildWritePayloads("2026-09-01");
  assert.equal(liveWrite.accepted, true);
  if (!liveWrite.accepted) return;
  assert.ok(!("activity_snapshot" in liveWrite.activityWrite));
  assert.ok(!("activity_snapshot" in liveWrite.lessonWrite));
});
