import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// sendEmail.ts begins with `import "server-only"`, which is not a real
// installed package (it has no entry in node_modules/package.json -- Next
// itself resolves/aliases it at build time) and therefore cannot be
// imported directly in a plain node:test run, matching every other
// "server-only" file in this codebase (see
// activityReviewReader.historicalVisibility.test.ts's header comment for
// the original precedent). These assertions verify the real source
// directly instead. This stage deliberately sends no real email, so there
// is nothing to exercise via a live Resend call anyway.

const SOURCE = readFileSync("lib/email/sendEmail.ts", "utf8");

test("the module is server-only, matching this codebase's convention for provider/secret-holding files", () => {
  assert.match(SOURCE, /^import "server-only";/);
});

test("this is the only file that imports the Resend SDK, by declaring itself as such and importing it directly", () => {
  assert.match(SOURCE, /import \{ Resend \} from "resend";/);
});

test("sendEmail() accepts to/subject/html and an optional from, matching the requested small typed API", () => {
  assert.match(SOURCE, /export type SendEmailInput = \{\s*to: string;\s*subject: string;\s*html: string;\s*from\?: string;\s*\};/);
});

test("the result type is a discriminated union that cannot report success without an id, or failure without an error message", () => {
  assert.match(SOURCE, /export type SendEmailResult =\s*\| \{ success: true; id: string \}\s*\| \{ success: false; error: string \};/);
});

test("RESEND_API_KEY is read only from process.env, never a NEXT_PUBLIC_ variable, and never hard-coded", () => {
  assert.match(SOURCE, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(SOURCE, /NEXT_PUBLIC_RESEND/);
  assert.doesNotMatch(SOURCE, /re_[A-Za-z0-9]{10,}/); // a literal-looking Resend key
});

test("AD_ASTRA_EMAIL_FROM is the configurable default sender, and no production domain is hard-coded", () => {
  assert.match(SOURCE, /process\.env\.AD_ASTRA_EMAIL_FROM/);
  assert.doesNotMatch(SOURCE, /@ad-astra\.(com|co\.za|app)/i);
});

test("a missing sender is rejected before ever constructing a Resend client or making a network call", () => {
  const beforeClientConstruction = SOURCE.split("const client = getResendClient();")[0];
  assert.match(beforeClientConstruction, /if \(!sender\) \{/);
});

test("a missing RESEND_API_KEY produces a clean thrown error that sendEmail() catches, never an unhandled crash", () => {
  assert.match(SOURCE, /if \(!apiKey\) \{\s*throw new Error\("RESEND_API_KEY is not configured\."\);/);
  assert.match(SOURCE, /try \{\s*const client = getResendClient\(\);/);
  assert.match(SOURCE, /catch \(error\) \{\s*return \{\s*success: false,/);
});

test("a Resend-reported error is surfaced as a failure result, never silently treated as success", () => {
  assert.match(SOURCE, /if \(result\.error\) \{\s*return \{ success: false, error: result\.error\.message \};/);
});

test("no console logging exists in this module -- callers decide what (and what not) to log, so this file can never leak an API key or learner PII by accident", () => {
  assert.doesNotMatch(SOURCE, /console\.(log|error|warn|info)/);
});
