import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via its re-export
// target), so per this codebase's established precedent it cannot be
// invoked directly in a plain node:test run.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([submissionId]). Run this file explicitly, never via the standard
// glob runner:
//   node --import tsx "app/api/teacher/business-studies/reviews/[submissionId]/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/business-studies/reviews/[submissionId]/route.ts",
  "utf8",
);

// AD ASTRA -- REVIEW-RETURN EMAIL RELIABILITY REPAIR: this URL is kept
// only as a thin compatibility alias for the canonical, honestly-named
// app/api/teacher/reviews/[submissionId]/route.ts (used by all four
// subjects). It must never grow back into a second, duplicated
// implementation.
test("is a thin re-export of the canonical shared route's POST handler -- not a second implementation", () => {
  assert.match(
    SOURCE,
    /export \{ POST \} from "@\/app\/api\/teacher\/reviews\/\[submissionId\]\/route";/,
  );
});

test("contains no review/finalisation logic of its own -- no database access, no email trigger, no marking calculation", () => {
  assert.doesNotMatch(SOURCE, /createSupabaseAdminClient|sendReviewReturnedEmailIfDue|calculateTeacherReviewScore|authorizeTeacher/);
});
