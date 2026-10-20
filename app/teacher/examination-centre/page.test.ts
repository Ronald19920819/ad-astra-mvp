import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// app/teacher/examination-centre/page.tsx transitively imports
// "server-only" (via getAuthenticatedTeacherProfile), so per this
// codebase's established precedent (see app/store/page.test.ts's own
// equivalent, untested-directly server component) it cannot be invoked
// directly in a plain node:test run. These tests verify the real source
// directly.

const SOURCE = readFileSync("app/teacher/examination-centre/page.tsx", "utf8");

test("the teacher is resolved via the canonical getAuthenticatedTeacherProfile(), never a client-supplied id, and does NOT require a teaching overview (assigned subjects/learners/lessons/activities)", () => {
  assert.match(
    SOURCE,
    /import \{ getAuthenticatedTeacherProfile \} from "@\/lib\/supabase\/teacherProfile";/,
  );
  assert.match(SOURCE, /const teacherProfile = await getAuthenticatedTeacherProfile\(\);/);
  assert.doesNotMatch(SOURCE, /import \{[^}]*Dashboard/);
  assert.doesNotMatch(SOURCE, /getTeacherDashboardInsights\(/);
});

test("an unauthenticated teacher renders a graceful inline message, never private data, and never a redirect", () => {
  assert.match(SOURCE, /if \(!teacherProfile\) \{/);
  assert.match(SOURCE, /Teacher sign-in is required\./);
  assert.doesNotMatch(SOURCE, /redirect\(/);
});

test("the hero uses the exact supplied image path, is a single card (heading overlaid on the image, never two separate cards), and preserves the real aspect ratio via next/image fill + object-cover", () => {
  assert.match(SOURCE, /import Image from "next\/image";/);
  assert.match(SOURCE, /src="\/images\/examination-centre-header\.png"/);
  assert.match(SOURCE, /\bfill\b/);
  assert.match(SOURCE, /object-cover object-center/);
  assert.equal((SOURCE.match(/<Image\b/g) ?? []).length, 1);
});

test("the hero heading and subtitle are exactly as specified", () => {
  assert.match(SOURCE, /AD Astra Examination Centre<\/h1>/);
  assert.match(SOURCE, /Create\. Assess\. Inspire\./);
});

test("the hero follows the Store's exact rounded-corner/responsive-height/gradient-overlay conventions", () => {
  assert.match(SOURCE, /rounded-\[2rem\] border border-blue-100 shadow-lg sm:h-64 lg:h-80/);
  assert.match(SOURCE, /bg-gradient-to-br from-\[#102A43\]\/90 via-\[#102A43\]\/40 to-transparent/);
});

test("both primary action cards exist with the exact required heading/description text", () => {
  assert.match(SOURCE, /Create Examination<\/h2>/);
  assert.match(SOURCE, /Design professional examination papers with Kingdom\./);
  assert.match(SOURCE, /Mark Examination<\/h2>/);
  assert.match(SOURCE, /Scan learner scripts and review Kingdom&apos;s marking\./);
});

test("neither primary action card is a Link, has an href, or has an onClick -- their destination workflows do not exist yet, so neither must navigate anywhere or appear as a working link", () => {
  const cardsSection = SOURCE.slice(
    SOURCE.indexOf("grid grid-cols-1 gap-4 lg:grid-cols-2"),
    SOURCE.indexOf("My Examinations"),
  );
  assert.doesNotMatch(cardsSection, /<Link\b/);
  assert.doesNotMatch(cardsSection, /href=/);
  assert.doesNotMatch(cardsSection, /onClick=/);
});

test("the two action cards stack on mobile (grid-cols-1) and sit side by side on desktop (lg:grid-cols-2), each using the same card styling for equal prominence", () => {
  assert.match(SOURCE, /className="grid grid-cols-1 gap-4 lg:grid-cols-2"/);
  const cardClassName = /flex items-center gap-4 rounded-\[2rem\] border border-\[#D9A106\]\/30 bg-\[#FFF8E6\] p-5 shadow-sm/g;
  assert.equal((SOURCE.match(cardClassName) ?? []).length, 2);
});

test("My Examinations renders the exact required empty-state copy, with no fictional records and no Supabase call", () => {
  assert.match(SOURCE, /My Examinations<\/h2>/);
  assert.match(SOURCE, /No examinations yet/);
  assert.match(
    SOURCE,
    /Your examination projects will appear here once you create or start\s*\n\s*marking an examination\./,
  );
  assert.doesNotMatch(SOURCE, /createSupabaseAdminClient|createSupabaseRequestClient/);
  assert.doesNotMatch(SOURCE, /\.from\(/);
});

test("no search, filter, or project-metadata controls exist in the My Examinations section yet", () => {
  const myExamsSection = SOURCE.slice(SOURCE.indexOf("My Examinations"));
  assert.doesNotMatch(myExamsSection, /<input\b/i);
  assert.doesNotMatch(myExamsSection, /<select\b/i);
});

test("back navigation is a deterministic Link to the teacher dashboard, never router.back()", () => {
  assert.match(SOURCE, /href="\/teacher"\s*\n\s*prefetch=\{false\}/);
  assert.doesNotMatch(SOURCE, /router\.back\(\)/);
  assert.doesNotMatch(SOURCE, /useRouter/);
});

test("no bottom navigation was added -- this is a focused sub-page, matching the established convention (e.g. app/library/[subjectKey]/[lessonId]/page.tsx)", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});

test("no new database table, migration, RPC call, Kingdom integration, or OpenAI call exists anywhere on this page -- 'Kingdom' appears only as plain display copy naming the future workflow owner, never an actual import or API call", () => {
  assert.doesNotMatch(SOURCE, /supabase\.rpc\(/);
  assert.doesNotMatch(SOURCE, /openai/i);
  assert.doesNotMatch(SOURCE, /import .*kingdom/i);
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.delete\(/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
