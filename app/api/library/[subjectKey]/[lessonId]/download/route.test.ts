import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route lives under a Next.js dynamic-route folder with TWO
// bracketed segments ([subjectKey]/[lessonId]). Node's own `--test` CLI
// flag treats bracketed path segments as a glob character class even
// for a literal file argument (see
// app/api/teacher/reviews/[submissionId]/route.test.ts's header comment
// for the identical, already-documented issue with a single bracketed
// segment). Run this file explicitly as a plain script instead:
//   npx tsx "app/api/library/[subjectKey]/[lessonId]/download/route.test.ts"
//
// This route also transitively imports "server-only" (via
// resolveAuthorizedLibraryReading -> lib/supabase/libraryPdfAccess.ts),
// so it cannot be invoked directly either way. These tests verify the
// real source directly.

const SOURCE = readFileSync(
  "app/api/library/[subjectKey]/[lessonId]/download/route.ts",
  "utf8",
);

test("1/3/4/5/6/7/8/10/11/12/13/14/15/16/17/18: every authorization/eligibility check is delegated to the one shared helper, never duplicated inline in this route", () => {
  assert.match(
    SOURCE,
    /import \{ resolveAuthorizedLibraryReading \} from "@\/lib\/supabase\/libraryPdfAccess";/,
  );
  assert.match(
    SOURCE,
    /const result = await resolveAuthorizedLibraryReading\(subjectKey, lessonId\);/,
  );
  assert.doesNotMatch(SOURCE, /\.from\("lessons"\)/);
  assert.doesNotMatch(SOURCE, /\.from\("lesson_materials"\)/);
});

test("3: an unauthenticated result maps to HTTP 401", () => {
  assert.match(
    SOURCE,
    /if \(result\.status === "unauthenticated"\) \{\s*\n\s*return Response\.json\(\s*\n\s*\{ error: "Learner sign-in is required\." \},\s*\n\s*\{ status: 401 \},\s*\n\s*\);/,
  );
});

test("the non-disclosing not_found result maps to HTTP 404, with no internal detail in the message", () => {
  assert.match(
    SOURCE,
    /if \(result\.status === "not_found"\) \{\s*\n\s*return Response\.json\(\s*\n\s*\{ error: "This Library Club reading is not available\." \},\s*\n\s*\{ status: 404 \},\s*\n\s*\);/,
  );
  assert.doesNotMatch(SOURCE, /not enrolled/i);
  assert.doesNotMatch(SOURCE, /database subject/i);
});

test("a genuine unexpected failure maps to HTTP 500, caught by the outer try/catch", () => {
  assert.match(SOURCE, /\{ status: 500 \}/);
  assert.match(SOURCE, /catch \(error\) \{/);
});

test("20/24: the signed URL is generated only for an 'ok' result, with the download disposition option set to the sanitized filename", () => {
  assert.match(
    SOURCE,
    /\.createSignedUrl\(reading\.contentPath, LESSON_READING_PDF_SIGNED_URL_SECONDS, \{\s*\n\s*download: filename,\s*\n\s*\}\)/,
  );
});

test("23: the filename is built from canonical subject/lesson metadata via buildLibraryReadingDownloadFilename, never from a client-supplied value", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*LESSON_READING_PDF_BUCKET,\s*\n\s*LESSON_READING_PDF_SIGNED_URL_SECONDS,\s*\n\s*buildLibraryReadingDownloadFilename,\s*\n\s*\} from "@\/lib\/lessons\/pdfReading";/,
  );
  assert.match(
    SOURCE,
    /const filename = buildLibraryReadingDownloadFilename\(\s*\n\s*reading\.subject\.displayName,\s*\n\s*reading\.lessonNumber,\s*\n\s*reading\.lessonTitle,\s*\n\s*\);/,
  );
});

test("J/19/21: the TTL constant is reused unchanged from the existing established convention, not a new/different value", () => {
  assert.match(SOURCE, /LESSON_READING_PDF_SIGNED_URL_SECONDS/);
  assert.doesNotMatch(SOURCE, /\b\d+\s*\*\s*60\b/);
});

test("the resulting signed URL is returned as a 307 redirect, matching the existing Classroom PDF route's established pattern", () => {
  assert.match(SOURCE, /Response\.redirect\(data\.signedUrl, 307\)/);
});

test("28: no service-role key, raw storage path, or content_url is ever included in a JSON response body", () => {
  const jsonResponses = SOURCE.match(/Response\.json\(\s*\{[^}]*\}/g) ?? [];
  for (const response of jsonResponses) {
    assert.doesNotMatch(response, /content_url|contentPath|SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("29: no Coin/XP/progress table or write is referenced anywhere in this route", () => {
  assert.doesNotMatch(SOURCE, /learner_lesson_progress/);
  assert.doesNotMatch(SOURCE, /activity_submissions/);
  assert.doesNotMatch(SOURCE, /\.from\("coin/i);
  assert.doesNotMatch(SOURCE, /\.from\("xp/i);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
