import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// SubjectActivityPage.tsx is a "use client" component using browser-only
// hooks and cannot be rendered in a plain node:test run. These:
//   1. mirror the real displayedReading derivation exactly, exercised
//      against Ethan Petersen's ACTUAL live submission snapshot (learner
//      5f119c26-f70e-47ac-8696-0f453069dda4, submission
//      2ace3600-c315-46c3-8b8a-2020604181e5, activity 84e42296-...,
//      captured verbatim from a read-only production query) -- the
//      previous version of this test suite only exercised
//      structurally-plausible fixtures, which is exactly how a hardcoded
//      `source_type: "pasted_text" as const` inside the real derivation
//      slipped past it undetected;
//   2. assert structural properties of the real source directly
//      (established precedent, e.g. lib/auth/accountRole.test.mjs).

const SOURCE = readFileSync("components/subjects/SubjectActivityPage.tsx", "utf8");
const ROUTE_SOURCE = readFileSync(
  "app/api/activity-submissions/[submissionId]/reading-pdf/route.ts",
  "utf8",
);

// Matches lib/activities/activitySnapshot.ts's ActivitySnapshotReading.
type SnapshotReadingFixture = {
  id: string;
  title: string;
  sourceType: "pasted_text" | "pdf";
  contentText: string;
  pdfStoragePath: string | null;
};

// Verbatim activity_snapshot.reading for Ethan's real submission (captured
// via a read-only query during this investigation).
const ETHAN_REAL_SNAPSHOT_READING: SnapshotReadingFixture = {
  id: "439791bd-cb61-4253-ac40-1aa35dc1926f",
  title: "How Writers Organise Fiction to Shape Meaning and Reader Response",
  sourceType: "pdf",
  contentText: "",
  pdfStoragePath:
    "activity-submissions/5f119c26-f70e-47ac-8696-0f453069dda4/84e42296-411c-4548-9207-25b1347c2756/e04ed3bc-17e4-46be-8299-4649f8f0f86f.pdf",
};

const PASTED_TEXT_SNAPSHOT_READING: SnapshotReadingFixture = {
  id: "reading-material-id",
  title: "A pasted-text reading",
  sourceType: "pasted_text",
  contentText: '{"format":"ad-astra-structured-reading","version":1,"blocks":[]}',
  pdfStoragePath: null,
};

// Mirrors SubjectActivityPage.tsx's displayedReading derivation exactly
// (the `submissionSnapshot ? {...} : reading` block).
function deriveDisplayedReading(
  submissionSnapshotReading: SnapshotReadingFixture | null,
  liveReading: { source_type: string; content_text: string | null } | null,
) {
  return submissionSnapshotReading
    ? {
        ...liveReading,
        id: submissionSnapshotReading.id,
        title: submissionSnapshotReading.title,
        source_type: submissionSnapshotReading.sourceType,
        content_text: submissionSnapshotReading.contentText,
      }
    : liveReading;
}

test("A: Ethan's actual historical PDF snapshot resolves as source_type 'pdf', not the previously-hardcoded 'pasted_text'", () => {
  const displayed = deriveDisplayedReading(ETHAN_REAL_SNAPSHOT_READING, null);
  assert.ok(displayed);
  assert.equal(displayed.source_type, "pdf");
});

test("C: the frozen PDF's empty contentText ('') does not, on its own, cause the pasted-text fallback -- the branch selection is driven by source_type, not by whether content_text happens to be truthy", () => {
  const displayed = deriveDisplayedReading(ETHAN_REAL_SNAPSHOT_READING, null);
  assert.ok(displayed);
  assert.equal(displayed.content_text, "");
  assert.equal(displayed.source_type, "pdf");
  // The real render condition is `displayedReading.source_type === "pdf"`,
  // which this proves evaluates true even though content_text is falsy.
});

test("D: a current (non-historical) PDF snapshot also resolves correctly -- this is not a special case for old data", () => {
  const currentPdfSnapshot: SnapshotReadingFixture = {
    id: "new-reading-id",
    title: "A current PDF reading",
    sourceType: "pdf",
    contentText: "",
    pdfStoragePath: "activity-submissions/learner/activity/new-file.pdf",
  };
  const displayed = deriveDisplayedReading(currentPdfSnapshot, null);
  assert.ok(displayed);
  assert.equal(displayed.source_type, "pdf");
});

test("E: a pasted-text snapshot still resolves as pasted_text and keeps its real content_text", () => {
  const displayed = deriveDisplayedReading(PASTED_TEXT_SNAPSHOT_READING, null);
  assert.ok(displayed);
  assert.equal(displayed.source_type, "pasted_text");
  assert.equal(displayed.content_text, PASTED_TEXT_SNAPSHOT_READING.contentText);
});

test("F: when there is genuinely no snapshot and no live reading, the derivation passes through null/absence rather than fabricating content", () => {
  const displayed = deriveDisplayedReading(null, null);
  assert.equal(displayed, null);
});

test("regression: the real source no longer hardcodes source_type to 'pasted_text' inside the snapshot derivation -- this exact literal is what made the PDF branch below unreachable for every submitted PDF reading", () => {
  assert.doesNotMatch(SOURCE, /source_type: "pasted_text" as const,/);
});

test("regression: the real source derives source_type from the snapshot's own sourceType field", () => {
  assert.match(SOURCE, /source_type: submissionSnapshot\.reading\.sourceType,/);
});

test("G: pre-submission, a PDF-backed reading still resolves through the live lesson-reading route (lessonId/materialId), unchanged", () => {
  assert.match(
    SOURCE,
    /<ProtectedPdfReading lessonId=\{displayedLesson\.id\} materialId=\{displayedReading\.id\} \/>/,
  );
});

test("B/H/I: post-submission review of a PDF-backed reading resolves through the submission's OWN frozen-snapshot PDF route, never the live lesson-reading route -- this is the fix for 'No reading content is available.'", () => {
  assert.match(
    SOURCE,
    /sourceUrl=\{`\/api\/activity-submissions\/\$\{submission\.id\}\/reading-pdf`\}/,
  );
});

test("the snapshot-PDF branch only activates when a snapshot AND a loaded submission both exist -- never falls back silently to a live material that may no longer represent what the learner was graded on", () => {
  const branch = SOURCE.match(
    /\{displayedReading\.source_type === "pdf" \? \(\s*submissionSnapshot && submission \? \(/,
  );
  assert.ok(branch, "expected the PDF branch to explicitly gate on submissionSnapshot && submission");
});

test("J: pasted-text material (any non-pdf source_type) is unaffected -- it still renders via ProtectedReading with content_text, whether pre- or post-submission", () => {
  assert.match(
    SOURCE,
    /<ProtectedReading content=\{displayedReading\.content_text\} scrollable \/>/,
  );
});

test("G (route): the frozen PDF route's access control is unchanged -- it only ever resolves a submission owned by the requesting learner", () => {
  assert.match(ROUTE_SOURCE, /\.eq\("learner_id", user\.id\)/);
  assert.match(
    ROUTE_SOURCE,
    /isActivitySubmissionPdfSnapshotPath\(\s*snapshot\.reading\.pdfStoragePath,\s*submission\.learner_id,\s*snapshot\.activity\.id,?\s*\)/,
  );
});
