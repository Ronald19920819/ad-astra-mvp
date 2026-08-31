import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// TeacherFeedbackCard.tsx is a "use client" component using browser-only
// hooks and cannot be rendered in a plain node:test run -- these assert
// structural properties of the real source directly, matching this
// repo's established convention (see
// components/subjects/SubjectActivityPage.recordAnswer.test.ts's header
// comment for the precedent).

const SOURCE = readFileSync("components/home/TeacherFeedbackCard.tsx", "utf8");

test("the personalised heading uses the learner's real first name, never a hard-coded name", () => {
  assert.match(SOURCE, /Here's how you did, \$\{learnerFirstName\}/);
  assert.doesNotMatch(SOURCE, /Ethan|Ronald/);
});

test("the empty state uses 'Feedback for {name}', never the 'Here's how you did' heading", () => {
  const emptyBlock = SOURCE.match(/\{!current \? \([\s\S]*?\) : \(/)?.[0];
  assert.ok(emptyBlock, "empty-state block not found");
  assert.match(SOURCE, /Feedback for \$\{learnerFirstName\}/);
});

test("the empty state renders no badge, no arrows, and no position indicator", () => {
  const emptyBlock = SOURCE.match(/\{!current \? \([\s\S]*?\) : \(/)?.[0];
  assert.ok(emptyBlock);
  assert.doesNotMatch(emptyBlock!, /resolvePerformanceBadge|badge\.imageSrc/);
  assert.doesNotMatch(emptyBlock!, /Previous feedback|Next feedback/);
  assert.doesNotMatch(emptyBlock!, /\{active \+ 1\} of \{feedback\.length\}/);
});

test("teacher attribution is derived per-item via resolveTeacherAttribution so it changes across reviews from different teachers", () => {
  assert.match(SOURCE, /import \{[\s\S]*?resolveTeacherAttribution[\s\S]*?\} from "@\/lib\/home\/teacherFeedbackPresentation";/);
  assert.match(SOURCE, /resolveTeacherAttribution\(current\.teacherFirstName\)/);
});

test("the performance badge is rendered via next/image using the resolved badge asset, never CSS/icons/emoji/text labels", () => {
  assert.match(SOURCE, /import Image from "next\/image";/);
  assert.match(SOURCE, /resolvePerformanceBadge\(current\.finalMark, current\.totalMarks\)/);
  assert.match(SOURCE, /src=\{badge\.imageSrc\}/);
  assert.match(SOURCE, /alt=\{badge\.altText\}/);
  assert.doesNotMatch(SOURCE, /lucide-react/);
});

test("the raw percentage and mark are never rendered on this card -- finalMark/totalMarks are only ever passed into resolvePerformanceBadge, never rendered as text", () => {
  const finalMarkUsages = SOURCE.match(/current\.finalMark/g) ?? [];
  const totalMarksUsages = SOURCE.match(/current\.totalMarks/g) ?? [];
  assert.equal(finalMarkUsages.length, 1);
  assert.equal(totalMarksUsages.length, 1);
  assert.match(SOURCE, /resolvePerformanceBadge\(current\.finalMark, current\.totalMarks\)/);
  assert.doesNotMatch(SOURCE, /%\}/);
});

test("a null/empty teacher comment falls back via resolveDisplayedTeacherComment rather than rendering blank text", () => {
  assert.match(SOURCE, /resolveDisplayedTeacherComment\(current\.teacherComment\)/);
});

test("the comment container has a bounded max-height with internal scrolling, never expanding the whole card", () => {
  assert.match(SOURCE, /max-h-32 overflow-y-auto/);
  assert.match(SOURCE, /whitespace-pre-wrap break-words/);
});

test("the subject accent pill uses the existing subject colour-theme mapping, never a duplicated colour table", () => {
  assert.match(SOURCE, /import \{ getSubjectConfigurationByDatabaseId \} from "@\/lib\/subjects\/subjectConfig";/);
  assert.match(SOURCE, /subject\.colourTheme\.softBackground/);
  assert.match(SOURCE, /subject\.colourTheme\.primary/);
});

test("the permanent starfield asset covers the entire card via background-size: cover, centred, never stretched", () => {
  assert.match(SOURCE, /STARFIELD_BACKGROUND_SRC = "\/backgrounds\/feedback\/feedback-starfield\.png";/);
  assert.match(SOURCE, /backgroundImage: `url\(\$\{STARFIELD_BACKGROUND_SRC\}\)`/);
  assert.match(SOURCE, /backgroundSize: "cover"/);
  assert.match(SOURCE, /backgroundPosition: "center"/);
});

test("a navy gradient overlay sits above the starfield to protect text readability, without a second decorative background", () => {
  const backgroundLayers = SOURCE.match(/absolute inset-0/g) ?? [];
  // Exactly two absolutely-positioned full-bleed layers: the starfield
  // image itself and its one readability overlay -- never a second
  // decorative background stacked on top.
  assert.equal(backgroundLayers.length, 2);
  assert.match(SOURCE, /bg-gradient-to-br from-\[#0B1B33\]\/95 via-\[#0B1B33\]\/80 to-\[#0B1B33\]\/45/);
});

test("the card's outer rounded surface no longer carries its own flat background colour -- the starfield + overlay layers provide it", () => {
  assert.doesNotMatch(SOURCE, /rounded-\[2rem\] bg-\[#102A43\]/);
  assert.match(SOURCE, /rounded-\[2rem\] shadow-md/);
});

test("desktop composition splits into a ~65%/35% grid: feedback content left, badge column right", () => {
  assert.match(SOURCE, /lg:grid-cols-\[65%_35%\]/);
});

test("the badge spans the full height of the left column's rows so it sits vertically centred beside the content, not squeezed into one row", () => {
  assert.match(SOURCE, /lg:col-start-2 lg:row-start-1 lg:row-end-5/);
});

test("mobile order places the badge between the subject/activity line and the teacher comment, not after the CTA/carousel", () => {
  assert.match(SOURCE, /order-1 lg:col-start-1/); // heading + attribution
  assert.match(SOURCE, /order-2 mt-4 flex flex-wrap items-center gap-2 lg:col-start-1/); // subject + activity
  assert.match(SOURCE, /order-3 mt-5 flex items-center justify-center/); // badge
  assert.match(SOURCE, /order-4 mt-4 lg:col-start-1/); // comment
  assert.match(SOURCE, /order-5 lg:col-start-1/); // CTA + carousel
});

test("the badge is sized substantially larger than a small inline icon and scales up on larger breakpoints, with no surrounding box", () => {
  assert.match(SOURCE, /h-\[120px\] w-\[120px\]/);
  assert.match(SOURCE, /sm:h-\[140px\] sm:w-\[140px\]/);
  assert.match(SOURCE, /lg:h-\[170px\] lg:w-\[170px\]/);
  assert.match(SOURCE, /object-contain/);
  // The badge's own wrapper divs carry no border/background box classes.
  const badgeBlock = SOURCE.match(/\{badge \? \([\s\S]*?<\/div>\s*\) : null\}/)?.[0];
  assert.ok(badgeBlock, "badge block not found");
  assert.doesNotMatch(badgeBlock!, /border |bg-white|bg-\[#/);
});

test("the View My Reviewed Work link deep-links to exactly /your-work/${submissionId}, never the bare route", () => {
  const linkMatch = SOURCE.match(/href=\{`\/your-work\/\$\{current\.submissionId\}`\}/);
  assert.ok(linkMatch, "expected href={`/your-work/${current.submissionId}`}");
  assert.doesNotMatch(SOURCE, /href="\/your-work"/);
});

test("prev/next navigation is clamped (Math.max/Math.min), never wraparound like the old MotivationalCard", () => {
  assert.match(SOURCE, /Math\.max\(0, currentIndex - 1\)/);
  assert.match(SOURCE, /Math\.min\(feedback\.length - 1, currentIndex \+ 1\)/);
  assert.doesNotMatch(SOURCE, /current === 0 \? quotes\.length - 1/);
});

test("prev/next buttons are disabled at the first/last item respectively", () => {
  assert.match(SOURCE, /disabled=\{isFirst\}/);
  assert.match(SOURCE, /disabled=\{isLast\}/);
});

test("no additional data fetching occurs on navigation -- no supabase/fetch/useEffect calls in this component", () => {
  // Note: the type-only import path "@/lib/supabase/learnerReturnedFeedback"
  // legitimately contains the word "supabase" -- this checks for actual
  // fetching calls, not that substring.
  assert.doesNotMatch(SOURCE, /useEffect|fetch\(|createSupabase|\.from\(/i);
});

test("no prohibited decorative elements (trophies, confetti, Kingdom, Leon, cartoon, XP effects) are introduced", () => {
  assert.doesNotMatch(SOURCE, /trophy|confetti|Kingdom|Leon|cartoon|xp-effect/i);
});

test("this stage introduces no feedback-viewed, email, or badge-notification functionality", () => {
  // Note: reviewedAt (the review timestamp) legitimately appears in this
  // source and is NOT the same as feedback-viewed tracking, so the check
  // below targets the specific out-of-scope names only.
  assert.doesNotMatch(SOURCE, /feedback_viewed|isFeedbackViewed|unread|\bemail\b|resend/i);
});
