import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewReturnedEmail } from "./reviewReturned";

const BASE_DATA = {
  learnerFirstName: "Ethan",
  teacherFirstName: "Ronald",
  subjectName: "Business Studies",
  activityTitle: "Activity 10",
  reviewedWorkUrl: "https://app.ad-astra.example/your-work/abc-123",
};

test("subject line matches the requested concept exactly", () => {
  const { subject } = buildReviewReturnedEmail(BASE_DATA);
  assert.equal(subject, "Your Business Studies Activity 10 has been reviewed");
});

test("the body greets the learner by their real first name", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.match(html, /Hi Ethan,/);
});

test("teacher attribution uses the real teacher first name when available", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.match(html, /Teacher Ronald has reviewed your Business Studies Activity 10\./);
});

test("teacher attribution falls back to 'Your teacher has' when no teacher name is available", () => {
  const { html } = buildReviewReturnedEmail({ ...BASE_DATA, teacherFirstName: null });
  assert.match(html, /Your teacher has reviewed your Business Studies Activity 10\./);
  assert.doesNotMatch(html, /Teacher null/);
});

test("the body names the subject and activity", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.match(html, /Business Studies/);
  assert.match(html, /Activity 10/);
});

test("the CTA links directly to the given reviewed-work URL, never a bare /home or /your-work list", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.match(html, /href="https:\/\/app\.ad-astra\.example\/your-work\/abc-123"/);
  assert.match(html, />View My Reviewed Work</);
});

test("no mark, percentage, or score of any kind appears in the email", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.doesNotMatch(html, /%|\d+\s*\/\s*\d+|\bmark\b|\bscore\b/i);
});

test("no teacher comment, Kingdom data, or learner answer content appears -- the data type itself has no field for any of it", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.doesNotMatch(html, /kingdom/i);
  assert.doesNotMatch(html, /teacher_comment|teacherComment|kingdomFeedback|kingdom_feedback/);
  // The template's only "feedback" reference is the fixed, data-free
  // sentence "Your feedback is ready in AD Astra" -- there is no
  // teacherComment/answer field on ReviewReturnedEmailData for any actual
  // feedback content to be interpolated from.
  assert.match(html, /Your feedback is ready in AD Astra\./);
});

test("no performance badge or badge asset reference appears in the email", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.doesNotMatch(html, /badge|stellar|on-course|course-correction/i);
});

test("the footer reads AD Astra", () => {
  const { html } = buildReviewReturnedEmail(BASE_DATA);
  assert.match(html, />AD Astra</);
});
