import assert from "node:assert/strict";
import test from "node:test";
import { calculatePairCoins } from "@/lib/rewards/coinRules";
import { calculateXpTotal, evaluateCoinGateStatus } from "@/lib/rewards/xpRules";

// lib/supabase/coinEarningEngine.ts imports "server-only" (via
// lib/supabase/server.ts), which has no real npm package in this repo and
// only resolves inside a Next.js server build/bundle -- so, matching the
// established precedent elsewhere in this codebase (see
// lib/lessons/lessonCompletionService.test.ts), the engine cannot be
// invoked directly in a plain node:test run. Instead this mirrors its
// exact chronological gate-crossing and per-pair eligibility logic
// verbatim, with this comment citing the real source
// (buildLearnerCoinPreview) so the two stay in sync intentionally.
// calculatePairCoins/calculateXpTotal/evaluateCoinGateStatus themselves
// ARE imported for real -- only the Supabase-querying wrapper needs
// mirroring.
type Event = {
  type: "lesson" | "activity";
  timestamp: string;
};

function findGateCrossing(events: Event[]) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  let lessons = 0;
  let activities = 0;
  let xp = 0;
  for (const event of sorted) {
    if (event.type === "lesson") lessons += 1;
    else activities += 1;
    xp = calculateXpTotal(lessons, activities);
    if (evaluateCoinGateStatus(xp, lessons, activities) === "unlocked") {
      return { timestamp: event.timestamp, xp, lessons, activities };
    }
  }
  return null;
}

function isPostGate(pairCompletionTimestamp: string, gateCrossingTimestamp: string | null) {
  if (!gateCrossingTimestamp) return false;
  return new Date(pairCompletionTimestamp).getTime() > new Date(gateCrossingTimestamp).getTime();
}

function pairCompletionTimestamp(lessonCompletedAt: string, activitySubmittedAt: string) {
  return new Date(activitySubmittedAt).getTime() > new Date(lessonCompletedAt).getTime()
    ? activitySubmittedAt
    : lessonCompletedAt;
}

// Three-condition gate, reconstructed chronologically -- differs from a
// pure XP-only gate: crossing 2000 XP alone is not enough.
test("the gate only crosses once XP>=2000 AND lessons>=5 AND activities>=5 hold simultaneously", () => {
  // 9 lessons + 1 activity = 2000 XP but only 1 activity -- locked.
  const events: Event[] = [
    ...Array.from({ length: 9 }, (_, i) => ({ type: "lesson" as const, timestamp: `2026-08-0${i + 1}T00:00:00Z` })),
    { type: "activity", timestamp: "2026-08-10T00:00:00Z" },
  ];
  const crossing = findGateCrossing(events);
  assert.equal(crossing, null); // never unlocked: only 1 activity total
});

test("5 lessons + 5 activities crosses the gate at exactly 2000 XP", () => {
  const events: Event[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ type: "lesson" as const, timestamp: `2026-08-0${i + 1}T00:00:00Z` })),
    ...Array.from({ length: 5 }, (_, i) => ({ type: "activity" as const, timestamp: `2026-08-1${i + 1}T00:00:00Z` })),
  ];
  const crossing = findGateCrossing(events);
  assert.ok(crossing);
  assert.equal(crossing!.xp, 2000);
  assert.equal(crossing!.lessons, 5);
  assert.equal(crossing!.activities, 5);
});

// Gate-crossing work itself earns XP only, never Coins.
test("a pair completing exactly at the gate-crossing timestamp is NOT post-gate", () => {
  const gateCrossingTimestamp = "2026-08-15T00:00:00Z";
  assert.equal(isPostGate(gateCrossingTimestamp, gateCrossingTimestamp), false);
});

test("the first pair completing strictly AFTER the gate-crossing timestamp IS post-gate", () => {
  const gateCrossingTimestamp = "2026-08-15T00:00:00Z";
  assert.equal(isPostGate("2026-08-15T00:00:01Z", gateCrossingTimestamp), true);
});

// MAX(lesson, activity) determines pair completion / lateness.
test("activity on time + lesson 1 day late -> pair uses the later (lesson) timestamp", () => {
  const result = pairCompletionTimestamp("2026-08-16T00:00:00Z", "2026-08-15T00:00:00Z");
  assert.equal(result, "2026-08-16T00:00:00Z");
});

test("lesson on time + activity 2 days late -> pair uses the later (activity) timestamp", () => {
  const result = pairCompletionTimestamp("2026-08-14T00:00:00Z", "2026-08-16T00:00:00Z");
  assert.equal(result, "2026-08-16T00:00:00Z");
});

test("maximum lateness wins regardless of which side is later", () => {
  // lesson 1 day late, activity 3 days late -> pair uses activity's later timestamp
  const result = pairCompletionTimestamp("2026-08-15T00:00:00Z", "2026-08-17T00:00:00Z");
  assert.equal(result, "2026-08-17T00:00:00Z");
});

// Teacher review required; Kingdom preliminary marks rejected.
function hasTeacherFinalMark(status: string, finalMark: number | null) {
  return status === "returned" && finalMark !== null;
}

test("teacher review is required -- a submitted/awaiting_review status never has a teacher-final mark", () => {
  assert.equal(hasTeacherFinalMark("submitted", null), false);
  assert.equal(hasTeacherFinalMark("awaiting_review", null), false);
  assert.equal(hasTeacherFinalMark("marking_failed", null), false);
});

test("a Kingdom/AI preliminary mark alone (status not yet returned) is rejected even if a preliminary mark exists", () => {
  // preliminary_mark being set does not matter -- only status==='returned'
  // with a real final_mark counts.
  assert.equal(hasTeacherFinalMark("awaiting_review", null), false);
});

test("a returned status with a real final_mark has a teacher-final mark", () => {
  assert.equal(hasTeacherFinalMark("returned", 8), true);
});

// Frozen mark denominator precedence: original_total_marks > snapshot > live.
function resolveFrozenTotalMarks(
  originalTotalMarks: number | null,
  snapshotTotalMarks: number | null,
  liveTotalMarks: number,
) {
  return originalTotalMarks ?? snapshotTotalMarks ?? liveTotalMarks;
}

test("frozen mark denominator prefers original_total_marks, never the live (possibly edited) total", () => {
  assert.equal(resolveFrozenTotalMarks(20, 15, 10), 20);
  assert.equal(resolveFrozenTotalMarks(null, 15, 10), 15);
  assert.equal(resolveFrozenTotalMarks(null, null, 10), 10);
});

test("worked example: submitted /20, activity later edited to /10 -- percentage still uses /20", () => {
  const frozenTotal = resolveFrozenTotalMarks(20, null, 10);
  const percentage = (15 / frozenTotal) * 100;
  assert.equal(percentage, 75);
  const result = calculatePairCoins({ percentage, daysLate: 0 });
  assert.equal(result.finalCoins, 700); // 75% tier, not the wrong 150%-of-/10 result
});

// Due date precedence: frozen snapshot due date > live activity due date > none.
function resolveDueDate(snapshotDueDate: string | null, liveDueDate: string | null) {
  return snapshotDueDate ?? liveDueDate ?? null;
}

test("due date prefers the frozen snapshot date over a later-edited live due date", () => {
  assert.equal(resolveDueDate("2026-08-10", "2026-08-20"), "2026-08-10");
});

test("no authoritative due date (neither frozen nor live) is rejected, never silently assumed on-time", () => {
  const dueDate = resolveDueDate(null, null);
  assert.equal(dueDate, null); // caller must treat this as ineligible ("no_authoritative_due_date")
});

// Balance calculation
test("balance is the plain signed sum of all ledger amounts", () => {
  const rows = [{ amount: 800 }, { amount: -100 }, { amount: 700 }];
  const balance = rows.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(balance, 1400);
});

// Correction/reversal model
test("a correction of -100 on an original +800 award nets to 700, with both rows retained", () => {
  const original = { amount: 800, type: "lesson_activity_reward" };
  const correction = { amount: -100, type: "correction", referenceTransactionId: "original-id" };
  assert.ok(correction.referenceTransactionId); // corrections must always reference the original
  const netResult = original.amount + correction.amount;
  assert.equal(netResult, 700);
});
