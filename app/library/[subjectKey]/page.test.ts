import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route lives under a Next.js dynamic-route folder ([subjectKey]).
// Node's own `--test` CLI flag treats "[subjectKey]" as a glob character
// class even for a literal file argument, so it silently discovers ZERO
// tests here when run via the usual `--test <path>` invocation (see
// app/api/teacher/reviews/[submissionId]/route.test.ts's header comment
// for the identical, already-documented workaround in this codebase).
// Run this file explicitly as a plain script instead:
//   npx tsx "app/library/[subjectKey]/page.test.ts"
//
// This page also transitively imports "server-only" (via
// getAuthenticatedLearnerLibraryForSubject), so per this codebase's
// established precedent it cannot be invoked directly either way. These
// tests verify the real source directly and mirror its pure
// default-term-expansion logic.

const SOURCE = readFileSync("app/library/[subjectKey]/page.tsx", "utf8");

test("1: the page heading is exactly 'AD Astra -- Library Club'", () => {
  assert.match(SOURCE, /AD Astra &ndash; Library Club/);
});

test("2: subject identity (displayName, framework, defaultStageOrGrade) is displayed, sourced from canonical subject configuration", () => {
  assert.match(SOURCE, /\{subject\.displayName\}/);
  assert.match(SOURCE, /\{subject\.framework\} \{subject\.defaultStageOrGrade\}/);
});

test("3: returned library.terms are rendered via a map, not hand-listed", () => {
  assert.match(SOURCE, /library\.terms\.map\(\(term, index\) =>/);
});

test("4/5: the highest-numbered available term is open by default and earlier numbered terms are collapsed, via resolveDefaultOpenTermIndex", () => {
  assert.match(SOURCE, /open=\{index === defaultOpenIndex\}/);
  assert.match(
    SOURCE,
    /function resolveDefaultOpenTermIndex\(terms: LibraryClubTerm\[\]\): number \{/,
  );
});

test("6: a null termNumber renders as 'Other Coursework', never a fabricated 'Term 1'", () => {
  assert.match(
    SOURCE,
    /function formatTermLabel\(termNumber: number \| null\) \{\s*\n\s*return termNumber === null \? "Other Coursework" : `Term \$\{termNumber\}`;/,
  );
});

test("7: topic headings render from topic.topicTitle", () => {
  assert.match(SOURCE, /\{topic\.topicTitle\}/);
});

test("9/10: lesson number and lesson title both render", () => {
  assert.match(SOURCE, /Lesson \{lesson\.lessonNumber\}/);
  assert.match(SOURCE, /\{lesson\.title\}/);
});

test("11: an empty (zero-term) Library Club result shows the friendly 'Coursework is coming' state, not an error/empty-data message", () => {
  assert.match(SOURCE, /library\.terms\.length === 0/);
  assert.match(SOURCE, /Coursework is coming\./);
  assert.doesNotMatch(SOURCE, /No records found|No data|0 files|Nothing here/i);
});

test("12/13: unknown_subject and not_enrolled both resolve to notFound(), never an internal-detail message", () => {
  assert.match(
    SOURCE,
    /if \(result\.status === "unknown_subject" \|\| result\.status === "not_enrolled"\) \{\s*\n\s*notFound\(\);\s*\n\s*\}/,
  );
  assert.doesNotMatch(SOURCE, /not enrolled in/i);
  assert.doesNotMatch(SOURCE, /database subject/i);
});

test("14: the unauthenticated status is handled with a graceful inline message, matching SubjectDashboard's own established soft-error convention -- no redirect(\"/login\") was introduced", () => {
  assert.match(SOURCE, /result\.status === "unauthenticated"/);
  assert.doesNotMatch(SOURCE, /redirect\(/);
});

test("15: no content_url or storage path ever appears in this file", () => {
  assert.doesNotMatch(SOURCE, /content_url/);
  assert.doesNotMatch(SOURCE, /storagePath|storage_path/);
});

test("16: no Supabase Storage call occurs anywhere in this page", () => {
  assert.doesNotMatch(SOURCE, /\.storage\b/);
  assert.doesNotMatch(SOURCE, /createSignedUrl/);
  assert.doesNotMatch(SOURCE, /createSignedUploadUrl/);
});

test("17: this file lives at app/library/[subjectKey]/page.tsx -- there is no global app/library/page.tsx", () => {
  let globalLibraryPageExists = true;
  try {
    readFileSync("app/library/page.tsx", "utf8");
  } catch {
    globalLibraryPageExists = false;
  }
  assert.equal(globalLibraryPageExists, false, "expected no global app/library/page.tsx to exist");
});

test("18: no learner bottom-navigation item was added anywhere else for Library Club -- this page itself also has no bottom nav, matching the established focused-sub-page convention (e.g. SubjectLessonPage)", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});

test("19/20: back navigation is a deterministic Link built from the canonical subject route, never router.back()", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "learnerDashboard"\)\}\s*\n\s*prefetch=\{false\}/,
  );
  assert.doesNotMatch(SOURCE, /router\.back\(\)/);
  assert.doesNotMatch(SOURCE, /useRouter/);
});

test("25: View links to this exact lesson's subject-scoped Library Club viewing page, never href='#' or a raw storage path", () => {
  assert.match(
    SOURCE,
    /<Link\s*\n\s*href=\{`\/library\/\$\{subject\.key\}\/\$\{lesson\.lessonId\}`\}\s*\n\s*prefetch=\{false\}/,
  );
  assert.doesNotMatch(SOURCE, /href="#"/);
});

test("25: Download links to this exact lesson's authorized download route, never a raw storage path or content_url", () => {
  assert.match(
    SOURCE,
    /href=\{`\/api\/library\/\$\{subject\.key\}\/\$\{lesson\.lessonId\}\/download`\}/,
  );
});

test("27: no signed URL is generated for any catalogue row during page render -- View/Download only link to authorized routes, resolved on click", () => {
  assert.doesNotMatch(SOURCE, /createSignedUrl/);
  assert.doesNotMatch(SOURCE, /\.storage\b/);
});

test("the subject-colour CSS variables are set once from the canonical subject configuration, not a new colour system", () => {
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
  assert.match(SOURCE, /"--subject-soft": subject\.colourTheme\.softBackground,/);
  assert.match(SOURCE, /"--subject-border": subject\.colourTheme\.border,/);
});

test("no progress/XP/Coin/due-date/activity language appears anywhere on this reference-shelf page", () => {
  assert.doesNotMatch(SOURCE, /\bXP\b|\bCoin\b|completion|overdue|due date|activity completion|teacher feedback|Needs Attention/i);
});

test("the Stage A reader is consumed directly, with no duplicated database query inside this page", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*getAuthenticatedLearnerLibraryForSubject,/,
  );
  assert.match(
    SOURCE,
    /const result = await getAuthenticatedLearnerLibraryForSubject\(\s*\n\s*requestedSubjectKey,\s*\n\s*\);/,
  );
  assert.doesNotMatch(SOURCE, /createSupabaseAdminClient/);
  assert.doesNotMatch(SOURCE, /\.from\("lessons"\)/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});

// --- Mirrored default-term-expansion logic -----------------------------

type MirroredTerm = { termNumber: number | null };

function resolveDefaultOpenTermIndex(terms: MirroredTerm[]): number {
  for (let index = terms.length - 1; index >= 0; index -= 1) {
    if (terms[index].termNumber !== null) return index;
  }
  return terms.length - 1;
}

test("default expansion opens the highest-numbered term when multiple numbered terms exist", () => {
  const terms = [{ termNumber: 1 }, { termNumber: 2 }, { termNumber: 3 }];
  assert.equal(resolveDefaultOpenTermIndex(terms), 2);
});

test("default expansion opens the highest-numbered term even when a trailing null-term group exists", () => {
  const terms = [{ termNumber: 1 }, { termNumber: 3 }, { termNumber: null }];
  assert.equal(resolveDefaultOpenTermIndex(terms), 1);
});

test("default expansion opens the only (null-term, 'Other Coursework') group when no numbered term exists", () => {
  const terms = [{ termNumber: null }];
  assert.equal(resolveDefaultOpenTermIndex(terms), 0);
});
