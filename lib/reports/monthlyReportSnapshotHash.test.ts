import assert from "node:assert/strict";
import test from "node:test";

import { hashMonthlyReportSnapshot } from "./monthlyReportSnapshotHash";
import type { MonthlyReportPayload } from "./monthlyReportTypes";

function payload(overrides: Partial<MonthlyReportPayload> = {}): MonthlyReportPayload {
  return {
    schemaVersion: 1,
    meta: {
      learnerId: "learner-1",
      learnerName: "Ethan Petersen",
      subjectId: "subject-1",
      subjectName: "Business Studies",
      teacherId: "teacher-1",
      teacherName: "Ronald Petersen",
      reportMonth: "2026-08-01",
      generatedAt: "2026-09-01T00:00:00.000Z",
    },
    lessons: [],
    activities: [],
    academic: {
      selectedActivityCount: 0,
      effectiveActivityCount: 0,
      returnedActivityCount: 0,
      overdueMissingActivityCount: 0,
      awaitingReviewActivityCount: 0,
      notYetDueActivityCount: 0,
      academicPercentage: null,
      topicBreakdown: [],
    },
    engagement: {
      lessonsSelected: 0,
      lessonsCompleted: 0,
      lessonsOnTime: 0,
      lessonsLate: 0,
      lessonsOutstanding: 0,
      activitiesSelected: 0,
      activitiesSubmitted: 0,
      activitiesOnTime: 0,
      activitiesLate: 0,
      activitiesAwaitingReview: 0,
      activitiesOutstanding: 0,
      lessonCompletionRate: null,
      activitySubmissionRate: null,
      completionRate: null,
      lessonPunctualityRate: null,
      activityPunctualityRate: null,
      punctualityRate: null,
      onTimeWorkCompletedCount: 0,
      onTimeWorkDueCount: 0,
    },
    evidenceFlags: {
      insufficientMarkedEvidence: true,
      lowCompletionRatio: false,
      substantialOutstandingWork: false,
      unreviewedSubmissionsPresent: false,
      topicCoverageGaps: [],
      insufficientForTrend: true,
    },
    badge: {
      key: "course_correction",
      academicThresholdPassed: false,
      completionThresholdPassed: false,
      punctualityThresholdPassed: false,
      sufficientEvidence: false,
    },
    attendance: null,
    ...overrides,
  };
}

test("the same payload content always hashes to the same value", () => {
  const a = hashMonthlyReportSnapshot(payload());
  const b = hashMonthlyReportSnapshot(payload());
  assert.equal(a, b);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4B BUG 2 REGRESSION: meta.generatedAt
// is a fresh timestamp on every single recompute (reopening a draft,
// clicking Regenerate Comments again with no real change, etc.) -- it
// must NEVER affect the hash, or "is this report still current" would go
// spuriously stale on every recompute regardless of whether the
// learner's actual academic/report evidence changed at all. This is
// exactly the bug that produced a stale warning and Finalise Report
// appearing inconsistently after a successful regeneration.
test("two recomputations with IDENTICAL academic/report evidence but DIFFERENT generatedAt timestamps produce the SAME hash", () => {
  const first = hashMonthlyReportSnapshot(payload({ meta: { ...payload().meta, generatedAt: "2026-09-01T00:00:00.000Z" } }));
  const second = hashMonthlyReportSnapshot(payload({ meta: { ...payload().meta, generatedAt: "2026-09-01T00:05:32.981Z" } }));
  const third = hashMonthlyReportSnapshot(payload({ meta: { ...payload().meta, generatedAt: "2026-12-25T23:59:59.999Z" } }));
  assert.equal(first, second);
  assert.equal(first, third);
});

test("a genuinely changed identity fact in meta (e.g. teacherName) still changes the hash -- only generatedAt is excluded, not the whole meta object", () => {
  const before = hashMonthlyReportSnapshot(payload());
  const after = hashMonthlyReportSnapshot(
    payload({ meta: { ...payload().meta, teacherName: "A Different Teacher" } }),
  );
  assert.notEqual(before, after);
});

test("a changed selection (different academic result) produces a different hash", () => {
  const before = hashMonthlyReportSnapshot(payload());
  const after = hashMonthlyReportSnapshot(
    payload({
      academic: {
        selectedActivityCount: 1,
        effectiveActivityCount: 1,
        returnedActivityCount: 1,
        overdueMissingActivityCount: 0,
        awaitingReviewActivityCount: 0,
        notYetDueActivityCount: 0,
        academicPercentage: 80,
        topicBreakdown: [],
      },
    }),
  );
  assert.notEqual(before, after);
});

test("the hash is a short, stable hex string -- safe to store inline in the persisted kingdom_comments record", () => {
  const hash = hashMonthlyReportSnapshot(payload());
  assert.match(hash, /^[0-9a-f]{8}$/);
});

// AD ASTRA MONTHLY REPORT -- FINALISATION HASH-MISMATCH ROOT CAUSE.
//
// report_snapshot/kingdom_comments are stored in Postgres `jsonb` columns.
// Confirmed empirically against real stored rows: jsonb does NOT preserve
// the original JS object-literal key insertion order -- Postgres returns
// object keys ordered by (length, then lexicographic), completely
// unrelated to the order generateMonthlyReportPreview's own `return {...}`
// wrote them in. Every code path that reads a payload BACK from the
// database therefore has a DIFFERENT key order than a payload
// generateMonthlyReportPreview just built fresh in memory and never
// persisted -- even when the data is 100% identical. Because
// JSON.stringify is key-order-sensitive, this made
// kingdom_comments.snapshotHash (computed from a jsonb-round-tripped
// payload during comment generation) permanently unable to match
// finalizeMonthlyReport's own fresh in-memory recompute's hash, no matter
// how many times commentary was regenerated -- reproducible on every
// learner/subject, because the mismatch is structural, not data-dependent.
//
// This is the fundamental property whose absence caused the bug: hashing
// must be invariant to object KEY ORDER at every nesting depth (arrays
// keep their real, meaningful order -- only object key order is a
// serialisation artefact).
function reorderKeysDeep(value: unknown, reverse: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => reorderKeysDeep(item, reverse));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const reordered = reverse ? [...keys].reverse() : [...keys].sort();
    const result: Record<string, unknown> = {};
    for (const key of reordered) {
      result[key] = reorderKeysDeep(record[key], reverse);
    }
    return result;
  }
  return value;
}

test("hashing is invariant to object key order at every nesting depth -- reversing every object's keys throughout a realistic payload produces the SAME hash", () => {
  const realistic = payload({
    activities: [
      {
        activityId: "activity-1",
        lessonId: "lesson-1",
        lessonNumber: "3.1",
        title: "Activity 1",
        topicTitle: "Market Research",
        dueDate: "2026-08-04",
        dueDateBasis: "normal",
        submissionStatus: "returned",
        submittedAt: "2026-08-03T10:00:00.000Z",
        isLate: false,
        daysLate: 0,
        isOverdue: false,
        hasAuthoritativeMark: true,
        finalMark: 8,
        totalMarks: 10,
        percentage: 80,
      },
    ],
    academic: {
      selectedActivityCount: 1,
      effectiveActivityCount: 1,
      returnedActivityCount: 1,
      overdueMissingActivityCount: 0,
      awaitingReviewActivityCount: 0,
      notYetDueActivityCount: 0,
      academicPercentage: 80,
      topicBreakdown: [
        { topicTitle: "Market Research", earnedMarks: 8, availableMarks: 10, percentage: 80, activityCount: 1 },
      ],
    },
  });

  const originalOrderHash = hashMonthlyReportSnapshot(realistic);
  const reversedKeysHash = hashMonthlyReportSnapshot(reorderKeysDeep(realistic, true) as typeof realistic);
  const sortedKeysHash = hashMonthlyReportSnapshot(reorderKeysDeep(realistic, false) as typeof realistic);

  assert.equal(originalOrderHash, reversedKeysHash);
  assert.equal(originalOrderHash, sortedKeysHash);
});

test("array element ORDER still matters -- reordering activities within the array (not just object keys) changes the hash, because array order is real evidence (curriculum sequence), not a serialisation artefact", () => {
  const twoActivities = payload({
    activities: [
      { activityId: "a1", lessonId: "l1", lessonNumber: "3.1", title: "A1", topicTitle: null, dueDate: null, dueDateBasis: "normal", submissionStatus: "returned", submittedAt: null, isLate: null, daysLate: null, isOverdue: false, hasAuthoritativeMark: true, finalMark: 5, totalMarks: 10, percentage: 50 },
      { activityId: "a2", lessonId: "l2", lessonNumber: "3.2", title: "A2", topicTitle: null, dueDate: null, dueDateBasis: "normal", submissionStatus: "returned", submittedAt: null, isLate: null, daysLate: null, isOverdue: false, hasAuthoritativeMark: true, finalMark: 9, totalMarks: 10, percentage: 90 },
    ],
  });
  const reversedArrayOrder = payload({ activities: [...twoActivities.activities].reverse() });

  assert.notEqual(hashMonthlyReportSnapshot(twoActivities), hashMonthlyReportSnapshot(reversedArrayOrder));
});

// AD ASTRA MONTHLY REPORT -- API-BOUNDARY INVARIANT (required
// regardless of UI logic): after a successful /comments generation, the
// snapshotHash stored on kingdom_comments MUST equal
// hashMonthlyReportSnapshot(report_snapshot) computed from the SAME
// response. generateKingdomMonthlyReportComments (kingdomReportGeneration.ts)
// computes snapshotHash from the exact `payload` parameter it receives,
// and the /comments route passes recomputeMonthlyReportDraftSnapshot's
// OWN return value (the jsonb-round-tripped report_snapshot) as that
// parameter -- so simulating that exact round trip here proves the
// invariant holds now that hashing is key-order invariant.
test("API-boundary invariant: hashing a jsonb-round-tripped payload (arbitrary key order) matches hashing the pre-round-trip in-memory payload with the SAME evidence", () => {
  const freshInMemory = payload({
    activities: [
      { activityId: "a1", lessonId: "l1", lessonNumber: "3.1", title: "A1", topicTitle: "Topic A", dueDate: "2026-08-04", dueDateBasis: "normal", submissionStatus: "returned", submittedAt: "2026-08-03T10:00:00.000Z", isLate: false, daysLate: 0, isOverdue: false, hasAuthoritativeMark: true, finalMark: 8, totalMarks: 10, percentage: 80 },
    ],
  });
  // Simulates exactly what Postgres jsonb did to real stored rows in this
  // investigation: every object's keys reordered, values otherwise
  // untouched, array order preserved.
  const simulatedJsonbRoundTrip = reorderKeysDeep(freshInMemory, true) as typeof freshInMemory;

  const snapshotHashStoredWithComments = hashMonthlyReportSnapshot(simulatedJsonbRoundTrip);
  const hashOfReturnedSnapshotInSameResponse = hashMonthlyReportSnapshot(simulatedJsonbRoundTrip);

  assert.equal(snapshotHashStoredWithComments, hashOfReturnedSnapshotInSameResponse);
  // And it must ALSO equal a completely fresh, never-round-tripped
  // in-memory recompute of the identical evidence (what finalizeMonthlyReport
  // hashes) -- this is the exact comparison that was broken.
  assert.equal(snapshotHashStoredWithComments, hashMonthlyReportSnapshot(freshInMemory));
});

// AD ASTRA MONTHLY REPORT -- STAGE 4B: STALENESS RACE. This is the exact
// mechanism finalizeMonthlyReport relies on to reject finalisation when
// the learner's evidence changed after Kingdom's commentary was
// generated: draft generated -> Kingdom comments generated against
// snapshotHash A -> a learner submission is reviewed, changing the
// academic result -> the teacher attempts to finalise -> the FRESHLY
// recomputed snapshot now hashes to B, which no longer matches A, so
// finalisation must be rejected. Then: comments are regenerated against
// the current evidence (producing a NEW stored snapshotHash equal to B)
// -> the teacher finalises again -> the hashes now match -> success.
// finalizeMonthlyReport itself can't be exercised directly here (it is
// server-only and calls Supabase), but this proves the hash comparison it
// performs is genuinely sound for a realistic before/after pair, and the
// repository's own source-inspection tests prove it performs exactly this
// comparison in exactly this order.
test("staleness race: an activity being reviewed between comment generation and finalisation changes the snapshot hash, so a stale generation is correctly detected -- and regenerating against the new state produces a hash that matches again", () => {
  const beforeReview = payload({
    activities: [
      {
        activityId: "activity-1",
        lessonId: "lesson-1",
        lessonNumber: "3.1",
        title: "Activity 1",
        topicTitle: "Topic A",
        dueDate: "2026-08-04",
        dueDateBasis: "normal",
        submissionStatus: "awaiting_review",
        submittedAt: "2026-08-03T10:00:00.000Z",
        isLate: false,
        daysLate: 0,
        isOverdue: false,
        hasAuthoritativeMark: false,
        finalMark: null,
        totalMarks: null,
        percentage: null,
      },
    ],
    academic: {
      selectedActivityCount: 1,
      effectiveActivityCount: 0,
      returnedActivityCount: 0,
      overdueMissingActivityCount: 0,
      awaitingReviewActivityCount: 1,
      notYetDueActivityCount: 0,
      academicPercentage: null,
      topicBreakdown: [],
    },
  });

  // Kingdom generates commentary here; its stored snapshotHash === hash(beforeReview).
  const generatedAgainst = hashMonthlyReportSnapshot(beforeReview);

  // The teacher reviews the activity before the report is finalised --
  // the exact race this test is named for.
  const afterReview = payload({
    activities: [
      {
        activityId: "activity-1",
        lessonId: "lesson-1",
        lessonNumber: "3.1",
        title: "Activity 1",
        topicTitle: "Topic A",
        dueDate: "2026-08-04",
        dueDateBasis: "normal",
        submissionStatus: "returned",
        submittedAt: "2026-08-03T10:00:00.000Z",
        isLate: false,
        daysLate: 0,
        isOverdue: false,
        hasAuthoritativeMark: true,
        finalMark: 8,
        totalMarks: 10,
        percentage: 80,
      },
    ],
    academic: {
      selectedActivityCount: 1,
      effectiveActivityCount: 1,
      returnedActivityCount: 1,
      overdueMissingActivityCount: 0,
      awaitingReviewActivityCount: 0,
      notYetDueActivityCount: 0,
      academicPercentage: 80,
      topicBreakdown: [],
    },
  });

  // finalizeMonthlyReport recomputes fresh from live data immediately
  // before freezing -- this is that fresh recompute's hash.
  const currentSnapshotHash = hashMonthlyReportSnapshot(afterReview);

  // The rejection: the stored (stale) generation no longer matches.
  assert.notEqual(generatedAgainst, currentSnapshotHash);

  // Comments are regenerated against the CURRENT (afterReview) state --
  // the newly stored snapshotHash is computed from the same live data
  // finalisation will recompute, so it now matches.
  const regeneratedAgainst = hashMonthlyReportSnapshot(afterReview);
  assert.equal(regeneratedAgainst, currentSnapshotHash);
});
