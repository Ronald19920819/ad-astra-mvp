import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component importing next/navigation (useRouter, which
// throws outside a real router context) and lucide-react -- verified via
// source inspection rather than a direct render, matching this
// codebase's established precedent for such components.

const SOURCE = readFileSync("components/activities/TeacherSubmissionReviewForm.tsx", "utf8");

// AD ASTRA -- REVIEW-RETURN EMAIL RELIABILITY REPAIR.

test("posts to the canonical shared review route, never the old business-studies-specific URL", () => {
  assert.match(SOURCE, /fetch\(\s*\n\s*`\/api\/teacher\/reviews\/\$\{review\.id\}`,/);
  assert.doesNotMatch(SOURCE, /business-studies\/reviews/);
});

test("still sends the actual subject's databaseId in the request body -- authorization/validation stays subject-specific server-side even though the URL is now shared", () => {
  assert.match(SOURCE, /subjectId: subject\.databaseId,/);
});

test("reads the notification outcome from the response and builds one of exactly three teacher-facing messages, never implying the review itself failed", () => {
  assert.match(SOURCE, /notification\?: "sent" \| "failed" \| "not_applicable";/);
  assert.match(SOURCE, /Activity returned to learner\. Email notification sent\./);
  assert.match(SOURCE, /Activity returned to learner\. Email notification could not be sent\./);
  assert.match(SOURCE, /"Activity returned to learner\."/);
});

test("a legitimate re-edit ('not_applicable') gets the plain message with no email mention at all -- never a misleading failure notice", () => {
  const messageExpr = SOURCE.match(/result\.notification === "sent"[\s\S]*?: "Activity returned to learner\.",/)?.[0];
  assert.ok(messageExpr, "notification message ternary not found");
  assert.match(messageExpr!, /: "Activity returned to learner\.",\s*$/);
});

test("the notification message is transient (this-save-only) state, reset whenever a new edit starts or is cancelled -- it never persists stale text from a previous save", () => {
  assert.match(SOURCE, /const \[notificationMessage, setNotificationMessage\] = useState<string \| null>\(null\);/);
  const resetFn = SOURCE.match(/function resetToSavedReview\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(resetFn, "resetToSavedReview not found");
  assert.match(resetFn!, /setNotificationMessage\(null\);/);
});

test("no longer auto-navigates away immediately after a successful save -- the teacher can actually see the notification message before leaving", () => {
  assert.doesNotMatch(SOURCE, /router\.push\(/);
  assert.match(SOURCE, /router\.refresh\(\);/);
});

test("the returned-status banner shows the fresh notification message when one exists, falling back to the original static status text otherwise", () => {
  assert.match(SOURCE, /\{notificationMessage \?\? "Status: Returned"\}/);
});
