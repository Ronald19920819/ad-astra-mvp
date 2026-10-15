import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/libraryPdfAccess.ts imports "server-only" and calls
// createSupabaseAdminClient()/getAuthenticatedLearnerProfile(), so per
// this codebase's established precedent (see
// lib/supabase/learnerReturnedFeedback.test.ts's header comment) it
// cannot be invoked directly in a plain node:test run. Its two actual
// decision functions (isPublishedLessonForSubject,
// isEligibleLibraryReadingMaterial) are genuinely behaviourally tested,
// via real imports, in lib/lessons/pdfReading.test.ts -- this file only
// verifies that THIS module actually calls them (reuses them, rather
// than re-implementing the same checks inline) and that its surrounding
// orchestration (status collapsing, no storage call, no direct query
// bypassing the shared helper) matches the real source.

const SOURCE = readFileSync("lib/supabase/libraryPdfAccess.ts", "utf8");

test("3/4: authentication and active-learner status are resolved via the canonical getAuthenticatedLearnerProfile(), not a separate auth/profile query", () => {
  assert.match(
    SOURCE,
    /import \{ getAuthenticatedLearnerProfile \} from "@\/lib\/supabase\/learnerProfile";/,
  );
  assert.match(SOURCE, /const profile = await getAuthenticatedLearnerProfile\(\);/);
  assert.match(SOURCE, /if \(!profile\) \{\s*\n\s*return \{ status: "unauthenticated" \};/);
});

test("2/5/6/7: subject enrolment is checked against the exact resolved databaseId via verifyLearnerSubjectAccessForProfile, never familyKey or a client-supplied subjectId", () => {
  assert.match(
    SOURCE,
    /import \{ verifyLearnerSubjectAccessForProfile \} from "@\/lib\/supabase\/subjectAccess";/,
  );
  assert.match(
    SOURCE,
    /const access = verifyLearnerSubjectAccessForProfile\(profile, subject\.databaseId\);/,
  );
  assert.doesNotMatch(SOURCE, /familyKey/);
});

test("7/8/9/10: lesson eligibility reuses isPublishedLessonForSubject rather than an inline duplicate check", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*isEligibleLibraryReadingMaterial,\s*\n\s*isPublishedLessonForSubject,\s*\n\s*\} from "@\/lib\/lessons\/pdfReading";/,
  );
  assert.match(
    SOURCE,
    /if \(!lesson \|\| !isPublishedLessonForSubject\(lesson, subject\.databaseId\)\) \{/,
  );
});

test("11/12/13/14/15/16/17/18: reading-material eligibility reuses isEligibleLibraryReadingMaterial rather than an inline duplicate check", () => {
  assert.match(
    SOURCE,
    /!isEligibleLibraryReadingMaterial\(material, requestedLessonId, subject\.databaseId\)/,
  );
});

test("the lessons query selects by lesson id only -- subject/status/ownership are verified in code via the shared pure checks, not baked into the WHERE clause alone", () => {
  assert.match(SOURCE, /\.from\("lessons"\)/);
  assert.match(SOURCE, /\.eq\("id", requestedLessonId\)/);
});

test("the lesson_materials query is scoped to this exact lesson and 'reading' material_type", () => {
  assert.match(SOURCE, /\.from\("lesson_materials"\)/);
  assert.match(SOURCE, /\.eq\("lesson_id", requestedLessonId\)/);
  assert.match(SOURCE, /\.eq\("material_type", "reading"\)/);
});

test("malformed subjectKey/lessonId are rejected before any database query is issued", () => {
  assert.match(
    SOURCE,
    /if \(!isSubjectKey\(requestedSubjectKey\) \|\| !uuidPattern\.test\(requestedLessonId\)\) \{\s*\n\s*return \{ status: "not_found" \};/,
  );
});

test("27/T: this helper never calls Supabase Storage -- generating the signed URL is left entirely to the download route", () => {
  assert.doesNotMatch(SOURCE, /\.storage\b/);
  assert.doesNotMatch(SOURCE, /createSignedUrl/);
});

test("28: the canonical storage path (contentPath) is documented as server-side-only and is never itself the thing rendered to a learner by this helper's own code", () => {
  assert.match(SOURCE, /contentPath: string;/);
  assert.doesNotMatch(SOURCE, /console\.log\(.*contentPath/);
});

test("every distinguishable failure reason collapses into a single non-disclosing 'not_found' status, except the separately-handled 'unauthenticated' case", () => {
  const notFoundCount = (SOURCE.match(/return \{ status: "not_found" \};/g) ?? []).length;
  assert.ok(notFoundCount >= 4, "expected multiple independent checks to all resolve to the same 'not_found' status");
  assert.match(
    SOURCE,
    /export type LibraryPdfAccessResult =\s*\n\s*\| \{ status: "unauthenticated" \}\s*\n\s*\| \{ status: "not_found" \}\s*\n\s*\| \{ status: "ok"; reading: AuthorizedLibraryReading \};/,
  );
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
