import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// Repo-wide regression guard: lib/email/sendEmail.ts must remain the ONLY
// module that imports the Resend SDK directly. Every operational email
// feature (review-returned now; outstanding-work/inactivity reminders,
// mentor/parent escalation, Store notifications later) must go through
// sendEmail() instead. This uses git's own tracked-and-untracked file
// listing (respecting .gitignore) rather than a hand-maintained file list,
// so a future file that imports "resend" directly trips this test
// immediately.
test("lib/email/sendEmail.ts is the only source file importing the Resend SDK directly", () => {
  const trackedAndUntracked = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.ts", "*.tsx"],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);

  const grepResult = execFileSync(
    "git",
    ["grep", "--untracked", "-l", "-e", 'from "resend"', "--", ...trackedAndUntracked],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => !file.endsWith(".test.ts")); // test files assert its ABSENCE by name

  assert.deepEqual(grepResult, ["lib/email/sendEmail.ts"]);
});
