import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This component transitively imports "server-only" (via
// getSubjectLearningTracker -> lib/supabase/learningTrackerReader.ts) and
// cannot be invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync(
  "components/subjects/TeacherSubjectLearningTrackerPage.tsx",
  "utf8",
);

// AD ASTRA -- TEACHER SUBJECT LEARNING TRACKER DESKTOP ENHANCEMENT: this
// shared tracker drives all four subject families (Business Studies,
// English, Afrikaans, History). The existing Term -> Week -> Lesson
// accordion -> learner HTML table architecture is correct and untouched --
// the learner table is already a genuine table at every viewport width,
// wrapped in overflow-x-auto with a min-w-[760px] floor that provides
// horizontal-scroll safety on narrow screens. The only change is giving
// that existing structure more room: the outer content column and the
// bottom nav both widen to lg:max-w-6xl, matching the identical decision
// already implemented for the structurally similar Activity Review queue.
// No table, column, status, or subject-theme logic changed.

test("A/B/C: the outer content wrapper keeps its existing w-full min-w-0 max-w-3xl px-4 pt-4 and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto w-full min-w-0 max-w-3xl px-4 pt-4 lg:max-w-6xl">/,
  );
});

test("D/E: the learner-table wrapper keeps overflow-x-auto and the table keeps its min-w-[760px] floor, unchanged", () => {
  assert.match(
    SOURCE,
    /<div className="w-full min-w-0 overflow-x-auto border-t border-orange-100">/,
  );
  assert.match(SOURCE, /<table className="w-full min-w-\[760px\] text-xs">/);
});

test("F: the learner table receives no lg: width or layout treatment of its own", () => {
  const tableBlockStart = SOURCE.indexOf(
    '<table className="w-full min-w-[760px] text-xs">',
  );
  const tableBlockEnd = SOURCE.indexOf("</table>", tableBlockStart);
  const tableBlock = SOURCE.slice(tableBlockStart, tableBlockEnd);
  assert.doesNotMatch(tableBlock, /lg:/);
});

test("G: all six table columns remain present in order -- Learner, Video, Reading, Quiz, Status, Last Active", () => {
  const headerBlockStart = SOURCE.indexOf("<thead");
  const headerBlockEnd = SOURCE.indexOf("</thead>");
  const headerBlock = SOURCE.slice(headerBlockStart, headerBlockEnd);
  const columns = ["Learner", "Video", "Reading", "Quiz", "Status", "Last Active"];
  let lastIndex = -1;
  for (const column of columns) {
    const index = headerBlock.indexOf(`>${column}<`);
    assert.ok(index > -1, `expected column header "${column}" to be present`);
    assert.ok(index > lastIndex, `expected column "${column}" to remain in its existing order`);
    lastIndex = index;
  }
});

test("H: the Term -> Week hierarchy remains present, in that nesting order", () => {
  const termIndex = SOURCE.indexOf('"Term not set" : `Term ${term.termNumber}`');
  const weekIndex = SOURCE.indexOf('"Week not set" : `Week ${week.weekNumber}`');
  assert.ok(termIndex > -1 && weekIndex > -1);
  assert.ok(termIndex < weekIndex, "expected the Term heading to appear before the nested Week heading in source order");
});

test("I: lesson accordions remain native <details>/<summary>, one per lesson", () => {
  assert.match(SOURCE, /<details\s*\n\s*key=\{lesson\.id\}/);
  assert.match(SOURCE, /<summary className="flex w-full cursor-pointer list-none/);
});

test("J: no lg:grid-cols-* lesson/card restructuring was introduced anywhere in the file", () => {
  assert.doesNotMatch(SOURCE, /lg:grid-cols/);
  assert.doesNotMatch(SOURCE, /lg:grid\b/);
});

test("K/L: the subject-theme CSS-variable system and its existing orange override groups remain intact", () => {
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
  assert.match(SOURCE, /"--subject-soft": subject\.colourTheme\.softBackground,/);
  assert.match(SOURCE, /"--subject-border": subject\.colourTheme\.border,/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-50 \{/);
  assert.match(
    SOURCE,
    /\.subject-theme \.text-orange-500,\s*\n\s*\.subject-theme \.text-orange-600 \{/,
  );
  assert.match(SOURCE, /\.subject-theme \.border-orange-100 \{/);
});

test("M: all six existing links (Back to Dashboard + five bottom-nav destinations) retain prefetch={false}", () => {
  assert.match(
    SOURCE,
    /href=\{buildSubjectRoute\(subject, "teacherOverview"\)\}\s*\n\s*prefetch=\{false\}/,
  );
  for (const href of [
    "/teacher",
    "/teacher/subjects",
    "/teacher/messages",
    "/teacher/reports",
    "/teacher/profile",
  ]) {
    assert.match(
      SOURCE,
      new RegExp(`<Link href="${href.replace(/\//g, "\\/")}" prefetch=\\{false\\}>`),
    );
  }
  const prefetchCount = (SOURCE.match(/prefetch=\{false\}/g) ?? []).length;
  assert.equal(prefetchCount, 6, "expected exactly 6 prefetch={false} occurrences -- no new link was added");
});

test("N/O: the bottom navigation keeps its mobile max-w-md base and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">/,
  );
});

test("P: getSubjectLearningTracker remains referenced with its subject.databaseId argument unchanged", () => {
  assert.match(
    SOURCE,
    /lessons = await getSubjectLearningTracker\(subject\.databaseId\);/,
  );
});

test("Q/R: loadError and both empty-state wordings remain exactly as before", () => {
  assert.match(
    SOURCE,
    /loadError = "Unable to load learner participation\. Please try again\.";/,
  );
  assert.match(
    SOURCE,
    /No published \{subject\.displayName\} lessons available\./,
  );
  assert.match(
    SOURCE,
    /No learner participation has been recorded for \{subjectName\} yet\./,
  );
});

test("S: tracker lesson status labels remain Complete / Complete (Late) / Incomplete / Attention Required, with their existing colour classes", () => {
  assert.match(SOURCE, /if \(status === "Complete"\) return "Complete";/);
  assert.match(SOURCE, /if \(status === "Late"\) return "Complete \(Late\)";/);
  assert.match(SOURCE, /if \(status === "Incomplete"\) return "Incomplete";/);
  assert.match(SOURCE, /return "Attention Required";/);
  assert.match(SOURCE, /bg-green-100 text-green-700/);
  assert.match(SOURCE, /bg-amber-100 text-amber-700/);
  assert.match(SOURCE, /bg-slate-100 text-slate-600/);
  assert.match(SOURCE, /bg-red-100 text-red-700/);
});

test("T: no learner-level On Track / Needs Support / At Risk vocabulary was introduced -- that belongs to the separate support-status system, not this tracker", () => {
  assert.doesNotMatch(SOURCE, /"On Track"|"Needs Support"|"At Risk"/);
});

test("regression: no new navigation link, search, filter, sort control, or pagination was introduced", () => {
  assert.doesNotMatch(SOURCE, /<input/);
  assert.doesNotMatch(SOURCE, /type="search"/);
  assert.doesNotMatch(SOURCE, /onChange/);
  const linkCount = (SOURCE.match(/<Link\b/g) ?? []).length;
  assert.equal(linkCount, 6, "expected exactly 6 Link elements -- no learner-row or lesson link was added");
});

test("regression: data-layer call sites (Map aggregation entry points, progressIndicator, statusClasses/statusSymbol/statusLabel) remain referenced unchanged", () => {
  assert.match(SOURCE, /function progressIndicator\(/);
  assert.match(SOURCE, /function statusClasses\(status: TrackerLessonStatus\)/);
  assert.match(SOURCE, /function statusSymbol\(status: TrackerLessonStatus\)/);
  assert.match(SOURCE, /function statusLabel\(status: TrackerLessonStatus\)/);
  assert.match(SOURCE, /function buildGroups\(lessons: LearningTrackerLesson\[\]\): TrackerTermGroup\[\]/);
});
