import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This is a "use client" authoring component with no server-only import
// chain of its own, but it is still verified via source inspection -- the
// established convention for every other Teacher subject page in this
// desktop pass -- since the responsive architecture and the surrounding
// stateful authoring workflow are more reliably and precisely verified as
// source text than through a React render harness this codebase does not
// otherwise use.

const SOURCE = readFileSync(
  "components/subjects/TeacherSubjectActivitiesPage.tsx",
  "utf8",
);

// AD ASTRA -- TEACHER SUBJECT ACTIVITIES DESKTOP ENHANCEMENT (SMALL PASS):
// this shared authoring workspace drives all four subject families. This
// pass is deliberately minimal: (1) the outer workspace widens to
// lg:max-w-6xl, (2) the Total Marks and Due Date read-only summary boxes
// -- two independent siblings -- pair into a desktop-only lg:grid-cols-2
// row (mobile stacking/spacing preserved via space-y-3 lg:space-y-0), and
// (3) the bottom nav widens in lockstep. ActivityQuestionBuilder.tsx is
// NOT modified -- it has no max-width restriction of its own, so it
// naturally inherits the wider parent authoring card once the outer
// wrapper widens. No state, handler, API call, due-date logic, Kingdom
// behaviour, or question-card architecture was touched.

test("A/B: the outer workspace wrapper keeps its existing max-w-md and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="mx-auto max-w-md px-4 pt-3 lg:max-w-6xl">/);
});

test("C: the Create/Edit Activity card remains present at id=\"activity-editor\"", () => {
  assert.match(
    SOURCE,
    /id="activity-editor"\s*\n\s*className="mb-5 rounded-\[2rem\] border border-orange-100 bg-white p-5 shadow-sm"/,
  );
  assert.match(SOURCE, /\{editingActivityId \? "Edit Activity" : "Create Activity"\}/);
});

test("D: Activity Title remains a full-width input, unpaired, with its state binding unchanged", () => {
  assert.match(
    SOURCE,
    /<input\s*\n\s*value=\{activityTitle\}\s*\n\s*onChange=\{\(e\) => setActivityTitle\(e\.target\.value\)\}\s*\n\s*placeholder="Activity Title"\s*\n\s*className="w-full rounded-2xl border border-slate-200 p-3 outline-none"\s*\n\s*\/>/,
  );
});

test("E: Activity Instructions retains rows={3} and its full-width textarea", () => {
  assert.match(
    SOURCE,
    /<textarea\s*\n\s*value=\{activityInstructions\}\s*\n\s*onChange=\{\(event\) => setActivityInstructions\(event\.target\.value\)\}\s*\n\s*placeholder="Activity instructions"\s*\n\s*rows=\{3\}/,
  );
});

test("F: Linked Lesson select remains present with its due-date derivation onChange unchanged", () => {
  assert.match(SOURCE, /value=\{linkedLesson\}/);
  assert.match(
    SOURCE,
    /setDueDate\(selectedLesson\?\.expected_completion_date\?\.slice\(0, 10\) \?\? ""\);/,
  );
});

test("G/H: Total Marks and Due Date are grouped in a desktop-only lg:grid-cols-2 wrapper, with mobile stacking preserved via space-y-3 lg:space-y-0", () => {
  assert.match(
    SOURCE,
    /<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">/,
  );
  const wrapperStart = SOURCE.indexOf(
    '<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">',
  );
  const wrapperEnd = SOURCE.indexOf("<ActivityQuestionBuilder", wrapperStart);
  const wrapperBlock = SOURCE.slice(wrapperStart, wrapperEnd);
  assert.match(wrapperBlock, /Total Marks/);
  assert.match(wrapperBlock, /Due Date \(inherited from linked lesson\)/);
});

test("I: the Due Date label wording is unchanged", () => {
  assert.match(SOURCE, /Due Date \(inherited from linked lesson\)/);
});

test("J: dueDate remains a derived, read-only display -- no type=\"date\" input was introduced", () => {
  assert.doesNotMatch(SOURCE, /type="date"/);
  assert.match(SOURCE, /const \[dueDate, setDueDate\] = useState\(""\);/);
});

test("K/L: ActivityQuestionBuilder remains referenced with its exact existing props, unchanged", () => {
  assert.match(
    SOURCE,
    /<ActivityQuestionBuilder\s*\n\s*subjectKey=\{subjectKey\}\s*\n\s*questions=\{activityQuestions\}\s*\n\s*setQuestions=\{setActivityQuestions\}\s*\n\s*onTotalMarksChange=\{\(total\) => setMarks\(String\(total\)\)\}\s*\n\s*\/>/,
  );
});

test("M: no lg:grid-cols-2 was added around the ActivityQuestionBuilder invocation or question-card collection", () => {
  const builderIndex = SOURCE.indexOf("<ActivityQuestionBuilder");
  const askKingdomIndex = SOURCE.indexOf("askKingdom");
  const surroundingBlock = SOURCE.slice(builderIndex - 200, askKingdomIndex);
  assert.doesNotMatch(surroundingBlock, /lg:grid-cols-2/);
});

test("N/O: Ask Kingdom remains present and /api/kingdom/generate-activity remains referenced, unchanged", () => {
  assert.match(SOURCE, /onClick=\{askKingdom\}/);
  assert.match(SOURCE, /"Kingdom is thinking\.\.\." : "Ask Kingdom"/);
  assert.match(SOURCE, /"\/api\/kingdom\/generate-activity"/);
});

test("P/Q: Publish Activity and Save Changes button text/logic remain present, driven by editingActivityId and isPublishing", () => {
  assert.match(SOURCE, /onClick=\{\(\) => void publishActivity\(\)\}/);
  assert.match(
    SOURCE,
    /: editingActivityId\s*\n\s*\? "Save Changes"\s*\n\s*: "Publish Activity"\}/,
  );
});

test("R/S: Published Activities remains present at id=\"activity-library\", after the editor card in source order", () => {
  const editorIndex = SOURCE.indexOf('id="activity-editor"');
  const libraryIndex = SOURCE.indexOf('id="activity-library"');
  assert.ok(editorIndex > -1 && libraryIndex > -1);
  assert.ok(editorIndex < libraryIndex);
  assert.match(SOURCE, /Published Activities/);
});

test("T/U: the submission-impact dialog retains max-w-md and sm:items-center, untouched", () => {
  assert.match(
    SOURCE,
    /<div\s*\n\s*className="fixed inset-0 z-\[70\] flex items-end justify-center bg-black\/50 p-4 sm:items-center"\s*\n\s*role="presentation"\s*\n\s*>/,
  );
  assert.match(
    SOURCE,
    /className="w-full max-w-md rounded-\[2rem\] border border-orange-100 bg-white p-5 shadow-xl"/,
  );
  assert.doesNotMatch(SOURCE, /max-w-4xl|max-w-6xl.*role="dialog"|role="dialog"[\s\S]{0,200}lg:max-w/);
});

test("V: all six existing Links retain prefetch={false}, and no new Link was added", () => {
  const linkCount = (SOURCE.match(/<Link\b/g) ?? []).length;
  assert.equal(linkCount, 6, "expected exactly 6 Link elements -- no new navigation link was introduced");
  const prefetchCount = (SOURCE.match(/prefetch=\{false\}/g) ?? []).length;
  assert.equal(prefetchCount, 6);
});

test("W: the subject-theme styled-jsx system remains present, unchanged", () => {
  assert.match(SOURCE, /<style jsx global>\{`/);
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-500 \{/);
  assert.match(
    SOURCE,
    /\.subject-theme \.border-orange-100,\s*\n\s*\.subject-theme \.border-orange-200 \{/,
  );
});

test("X/Y: the bottom navigation keeps its mobile max-w-md base and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">/,
  );
});

test("Z: critical state declarations remain present, unchanged in kind", () => {
  assert.match(SOURCE, /const \[activityTitle, setActivityTitle\] = useState\(""\);/);
  assert.match(SOURCE, /const \[activityInstructions, setActivityInstructions\] = useState\(/);
  assert.match(SOURCE, /const \[linkedLesson, setLinkedLesson\] = useState\(""\);/);
  assert.match(SOURCE, /const \[marks, setMarks\] = useState\(""\);/);
  assert.match(SOURCE, /const \[dueDate, setDueDate\] = useState\(""\);/);
  assert.match(SOURCE, /const \[activityQuestions, setActivityQuestions\] =/);
  assert.match(SOURCE, /const \[editingActivityId, setEditingActivityId\] = useState<string \| null>\(/);
  assert.match(SOURCE, /const \[editingSubmissionCount, setEditingSubmissionCount\] = useState\(0\);/);
  assert.match(SOURCE, /const \[confirmedSubmissionImpact, setConfirmedSubmissionImpact\] =/);
  assert.match(SOURCE, /const \[activities, setActivities\] = useState<TeacherPublishedActivity\[\]>\(\[\]\);/);
  assert.match(SOURCE, /const \[pendingEditActivity, setPendingEditActivity\] =/);
  assert.match(SOURCE, /const \[confirmBeforeSave, setConfirmBeforeSave\] = useState\(false\);/);
  const useStateCount = (SOURCE.match(/useState[<(]/g) ?? []).length;
  assert.equal(useStateCount, 21, "expected the same useState call count as before this pass -- no state was added or removed");
});

test("AA: no manual answerText editor was introduced -- Kingdom remains the only source of answerText", () => {
  assert.doesNotMatch(SOURCE, /value=\{[^}]*answerText[^}]*\}/);
  assert.doesNotMatch(SOURCE, /placeholder="[^"]*[Ee]xpected [Aa]nswer/);
});

test("AB: due-date warning/validation wording remains present, unchanged", () => {
  assert.match(
    SOURCE,
    /This lesson has no due date yet\. Set one on the lesson before publishing this activity\./,
  );
  assert.match(SOURCE, /Select a linked lesson to see its due date\./);
  assert.match(
    SOURCE,
    /if \(!dueDate\) \{\s*\n\s*alert\(\s*\n\s*"This lesson has no due date yet\. Set one on the lesson before publishing this activity\.",\s*\n\s*\);/,
  );
});

test("regression: no lg: class was added anywhere outside the three approved locations (outer workspace, Total Marks/Due Date grouping, bottom nav)", () => {
  const lgMatches = SOURCE.match(/lg:[\w[\]/.-]+/g) ?? [];
  const approved = new Set([
    "lg:max-w-6xl",
    "lg:grid",
    "lg:grid-cols-2",
    "lg:gap-3",
    "lg:space-y-0",
  ]);
  const unexpected = lgMatches.filter((match) => !approved.has(match));
  assert.deepEqual(unexpected, [], "expected only the three approved desktop changes' classes to appear");
});

test("regression: the main element's min-height, background, and pb-24 bottom padding are unchanged", () => {
  assert.match(
    SOURCE,
    /className="subject-theme min-h-screen bg-slate-100 pb-24"/,
  );
});
