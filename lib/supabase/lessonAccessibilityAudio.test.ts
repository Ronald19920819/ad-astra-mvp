import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/lessonAccessibilityAudio.ts imports "server-only" (via its
// SupabaseClient usage matching every other lib/supabase/*.ts reader this
// session) and cannot be invoked directly in a plain node:test run -- see
// app/api/live-class/livekit-token/route.test.ts's header comment for the
// full precedent this mirrors. Instead these tests:
//   1. exercise a verbatim mirror of the staleness/isStale and
//      getLearnerAccessibilityAudio gating logic, and
//   2. assert structural properties of the real source directly.

const SOURCE = readFileSync("lib/supabase/lessonAccessibilityAudio.ts", "utf8");

// Mirrors getAccessibilityAudioStatus's isStale derivation exactly.
function mirroredIsStale(row: { sourceHash: string } | null, currentSourceHash: string) {
  return row !== null && row.sourceHash !== currentSourceHash;
}

// Mirrors getLearnerAccessibilityAudio's gate exactly.
function mirroredGetLearnerAccessibilityAudio(row: {
  transcript_status: string;
  audio_status: string;
  source_hash: string;
  audio_segments: Array<{ index: number; storagePath: string }>;
} | null, currentSourceHash: string) {
  if (
    !row ||
    row.transcript_status !== "approved" ||
    row.audio_status !== "ready" ||
    row.source_hash !== currentSourceHash ||
    row.audio_segments.length === 0
  ) {
    return { ready: false as const };
  }
  return { ready: true as const, segments: row.audio_segments };
}

test("K/H staleness: a row whose stored hash matches the current hash is not stale", () => {
  assert.equal(mirroredIsStale({ sourceHash: "abc" }, "abc"), false);
});

test("K staleness: a row whose stored hash differs from the current (live) hash is stale", () => {
  assert.equal(mirroredIsStale({ sourceHash: "abc" }, "def"), true);
});

test("a learner never prepared for accessibility (no row) is never considered stale -- it is simply not prepared", () => {
  assert.equal(mirroredIsStale(null, "abc"), false);
});

test("the learner gate refuses audio unless the transcript is approved", () => {
  const result = mirroredGetLearnerAccessibilityAudio(
    {
      transcript_status: "generated",
      audio_status: "ready",
      source_hash: "abc",
      audio_segments: [{ index: 0, storagePath: "x" }],
    },
    "abc",
  );
  assert.equal(result.ready, false);
});

test("the learner gate refuses audio unless the audio_status is ready", () => {
  const result = mirroredGetLearnerAccessibilityAudio(
    {
      transcript_status: "approved",
      audio_status: "generating",
      source_hash: "abc",
      audio_segments: [{ index: 0, storagePath: "x" }],
    },
    "abc",
  );
  assert.equal(result.ready, false);
});

test("K: the learner gate refuses STALE audio even when transcript_status is approved and audio_status is ready -- a changed reading always wins", () => {
  const result = mirroredGetLearnerAccessibilityAudio(
    {
      transcript_status: "approved",
      audio_status: "ready",
      source_hash: "old-hash",
      audio_segments: [{ index: 0, storagePath: "x" }],
    },
    "new-hash",
  );
  assert.equal(result.ready, false);
});

test("the learner gate refuses audio with zero segments even if every other field looks ready", () => {
  const result = mirroredGetLearnerAccessibilityAudio(
    {
      transcript_status: "approved",
      audio_status: "ready",
      source_hash: "abc",
      audio_segments: [],
    },
    "abc",
  );
  assert.equal(result.ready, false);
});

test("the learner gate allows audio only when every condition is genuinely satisfied", () => {
  const result = mirroredGetLearnerAccessibilityAudio(
    {
      transcript_status: "approved",
      audio_status: "ready",
      source_hash: "abc",
      audio_segments: [{ index: 0, storagePath: "x" }],
    },
    "abc",
  );
  assert.equal(result.ready, true);
});

test("staleness is never persisted as a stored boolean -- it is computed fresh from a live-vs-stored hash comparison on every read", () => {
  assert.doesNotMatch(SOURCE, /is_stale/);
  assert.match(SOURCE, /row\.sourceHash !== args\.currentSourceHash/);
});

test("PDF hashing downloads and hashes the actual stored bytes -- it never trusts a cached or client-supplied hash", () => {
  assert.match(SOURCE, /hashPdfBytes\(bytes\)/);
  assert.match(SOURCE, /\.download\(args\.contentUrl\)/);
});

test("a fresh transcript generation always resets prior approval and audio state, so audio can never outlive the transcript it was spoken from", () => {
  const generatedTranscriptWrite = SOURCE.match(
    /export async function saveGeneratedTranscript[\s\S]*?\n}\n/,
  )?.[0];
  assert.ok(generatedTranscriptWrite, "saveGeneratedTranscript not found");
  assert.match(generatedTranscriptWrite!, /transcript_status: "generated"/);
  assert.match(generatedTranscriptWrite!, /approved_at: null/);
  assert.match(generatedTranscriptWrite!, /audio_status: "not_generated"/);
});
