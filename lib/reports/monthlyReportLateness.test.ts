import assert from "node:assert/strict";
import test from "node:test";

import { resolveActivityTiming } from "./monthlyReportLateness";
import { LEGACY_ACTIVITY_5_ID } from "@/lib/rewards/legacyActivity5Window";
import { LEGACY_ACTIVITY_2_ID } from "@/lib/rewards/legacyActivity2Window";

const NORMAL_ACTIVITY_ID = "9b53a712-c551-4401-bc69-be9d2df9db0a";

test("normal activity submitted before its due date is on time with zero days late", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: true,
    submittedAt: "2026-08-03T10:00:00.000Z",
    liveDueDate: "2026-08-04",
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.isLate, false);
  assert.equal(timing.daysLate, 0);
  assert.equal(timing.dueDateBasis, "normal");
});

test("normal activity submitted 3 days after its due date is late by 3 days", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: true,
    submittedAt: "2026-08-07T10:00:00.000Z",
    liveDueDate: "2026-08-04",
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.isLate, true);
  assert.equal(timing.daysLate, 3);
});

test("the frozen submission snapshot's due date takes precedence over a later-edited live due date", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: true,
    submittedAt: "2026-08-05T10:00:00.000Z",
    liveDueDate: "2026-08-10", // edited after submission -- would (wrongly) show on-time
    snapshotDueDate: "2026-08-04", // the due date that was actually in effect at submission
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.dueDate, "2026-08-04");
  assert.equal(timing.isLate, true);
  assert.equal(timing.daysLate, 1);
});

test("a normal activity with no due date at all has indeterminate timing, never a fabricated date", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: true,
    submittedAt: "2026-08-05T10:00:00.000Z",
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.dueDate, null);
  assert.equal(timing.isLate, null);
  assert.equal(timing.daysLate, null);
});

test("a not-yet-submitted normal activity past its due date is overdue", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: false,
    submittedAt: null,
    liveDueDate: "2026-01-01",
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
    now: new Date("2026-08-31T00:00:00.000Z"),
  });
  assert.equal(timing.isOverdue, true);
  assert.equal(timing.isLate, null); // never "late" until actually submitted
});

test("a not-yet-submitted normal activity before its due date is not overdue", () => {
  const timing = resolveActivityTiming({
    activityId: NORMAL_ACTIVITY_ID,
    isSubmitted: false,
    submittedAt: null,
    liveDueDate: "2099-01-01",
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
    now: new Date("2026-08-31T00:00:00.000Z"),
  });
  assert.equal(timing.isOverdue, false);
});

test("legacy Activity 5: submission inside its 24h window is on time, never uses a fabricated due date", () => {
  const timing = resolveActivityTiming({
    activityId: LEGACY_ACTIVITY_5_ID,
    isSubmitted: true,
    submittedAt: "2026-07-10T05:00:00.000Z",
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: "2026-07-10T10:00:00.000Z",
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.dueDate, null);
  assert.equal(timing.dueDateBasis, "legacy_24h_window_activity_5");
  assert.equal(timing.isLate, false);
  assert.equal(timing.daysLate, 0);
});

test("legacy Activity 5: submission after the window end is late, using the window's own day-rounding rule", () => {
  const timing = resolveActivityTiming({
    activityId: LEGACY_ACTIVITY_5_ID,
    isSubmitted: true,
    submittedAt: "2026-07-11T11:00:00.000Z",
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: "2026-07-10T10:00:00.000Z",
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.isLate, true);
  assert.ok(timing.daysLate! >= 1);
});

test("legacy Activity 5 with no genuine submission anywhere yet has an unanchored window -- indeterminate timing, not overdue", () => {
  const timing = resolveActivityTiming({
    activityId: LEGACY_ACTIVITY_5_ID,
    isSubmitted: false,
    submittedAt: null,
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: null,
    legacyActivity2WindowEnd: null,
  });
  assert.equal(timing.isLate, null);
  assert.equal(timing.isOverdue, false);
});

test("legacy Activity 5 not yet submitted, with an anchored window already closed, is overdue", () => {
  const timing = resolveActivityTiming({
    activityId: LEGACY_ACTIVITY_5_ID,
    isSubmitted: false,
    submittedAt: null,
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: "2026-01-01T00:00:00.000Z",
    legacyActivity2WindowEnd: null,
    now: new Date("2026-08-31T00:00:00.000Z"),
  });
  assert.equal(timing.isOverdue, true);
});

test("legacy Activity 2 uses its own independent window, never confused with Activity 5's", () => {
  const timing = resolveActivityTiming({
    activityId: LEGACY_ACTIVITY_2_ID,
    isSubmitted: true,
    submittedAt: "2026-07-10T05:00:00.000Z",
    liveDueDate: null,
    snapshotDueDate: null,
    legacyActivity5WindowEnd: "2020-01-01T00:00:00.000Z", // deliberately wrong/irrelevant
    legacyActivity2WindowEnd: "2026-07-10T10:00:00.000Z",
  });
  assert.equal(timing.dueDateBasis, "legacy_24h_window_activity_2");
  assert.equal(timing.isLate, false);
});
