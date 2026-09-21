import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This is a large "use client" authoring component with 33 useState calls
// and no server-only import chain of its own, but it is still verified via
// source inspection -- the established convention for every other Teacher
// subject page in this desktop pass -- since the responsive architecture
// and the surrounding stateful authoring workflow are more reliably and
// precisely verified as source text than through a React render harness
// this codebase does not otherwise use for a component this size.

const SOURCE = readFileSync(
  "components/subjects/TeacherSubjectClassroomPage.tsx",
  "utf8",
);

// AD ASTRA -- TEACHER SUBJECT CLASSROOM DESKTOP ENHANCEMENT (SMALL PASS):
// this shared authoring workspace drives all four subject families. This
// pass is deliberately minimal: (1) the outer workspace widens to
// lg:max-w-6xl, (2) the single content-authoring modal's panel widens to
// lg:max-w-4xl (its mobile bottom-sheet / sm:centred behaviour is
// unchanged), (3) Lesson Number and Lesson Title -- two independent
// sibling metadata fields -- pair into a desktop-only lg:grid-cols-2 row
// (their existing mobile stacked spacing is preserved via
// space-y-3 lg:space-y-0), and (4) the bottom nav widens in lockstep. No
// other section, state variable, handler, API call, or piece of Kingdom/
// accessibility/due-date logic was touched. The 2176-line authoring
// architecture (33 useState declarations, one inline modal, one Lesson
// Library accordion) remains structurally identical.

test("A/B: the outer workspace wrapper keeps its existing max-w-md and adds lg:max-w-6xl", () => {
  assert.match(SOURCE, /<div className="mx-auto max-w-md px-4 pt-3 lg:max-w-6xl">/);
});

test("C/D: the content-authoring modal panel keeps w-full max-w-md and adds lg:max-w-4xl", () => {
  assert.match(
    SOURCE,
    /<div className="max-h-\[90vh\] w-full max-w-md overflow-y-auto rounded-\[2rem\] bg-white p-5 shadow-2xl lg:max-w-4xl">/,
  );
});

test("E: the modal overlay's fixed positioning, z-index, mobile bottom-sheet and sm:centred behaviour are unchanged", () => {
  assert.match(
    SOURCE,
    /<div className="fixed inset-0 z-\[60\] flex items-end justify-center bg-black\/50 px-4 py-6 sm:items-center">/,
  );
});

test("F: Lesson Number and Lesson Title are grouped in a desktop-only lg:grid-cols-2 wrapper, with mobile spacing preserved via space-y-3 lg:space-y-0", () => {
  assert.match(
    SOURCE,
    /<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">/,
  );
  const wrapperStart = SOURCE.indexOf(
    '<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">',
  );
  const wrapperEnd = SOURCE.indexOf(
    '<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">',
    wrapperStart,
  );
  const wrapperBlock = SOURCE.slice(wrapperStart, wrapperEnd);
  assert.match(wrapperBlock, /value=\{lessonNumber\}/);
  assert.match(wrapperBlock, /value=\{lessonTitle\}/);
});

test("G: Lesson Number/Title state bindings, onChange handlers and placeholders remain exactly as before", () => {
  assert.match(
    SOURCE,
    /value=\{lessonNumber\}\s*\n\s*onChange=\{\(e\) => setLessonNumber\(e\.target\.value\)\}\s*\n\s*placeholder="Lesson Number, for example 2\.7"/,
  );
  assert.match(
    SOURCE,
    /value=\{lessonTitle\}\s*\n\s*onChange=\{\(e\) => setLessonTitle\(e\.target\.value\)\}\s*\n\s*placeholder="Lesson Title"/,
  );
});

test("H: Topic remains outside the Lesson Number/Title desktop grouping and full-width", () => {
  assert.match(SOURCE, /htmlFor="lesson-topic"/);
  const topicIndex = SOURCE.indexOf('htmlFor="lesson-topic"');
  const groupingIndex = SOURCE.indexOf(
    '<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">',
  );
  const groupingCloseIndex = SOURCE.indexOf(
    "</div>",
    SOURCE.indexOf('placeholder="Lesson Title"'),
  );
  assert.ok(topicIndex > groupingCloseIndex, "expected Topic to render after the Lesson Number/Title grouping closes");
  assert.ok(groupingIndex > -1 && groupingIndex < topicIndex);
});

test("I: Expected Completion remains outside the Lesson Number/Title desktop grouping and full-width", () => {
  assert.match(SOURCE, /Expected Completion\{" "\}/);
  assert.match(SOURCE, /value=\{expectedCompletionDate\}/);
  const expectedCompletionIndex = SOURCE.indexOf("Expected Completion{\" \"}");
  const groupingCloseIndex = SOURCE.indexOf(
    "</div>",
    SOURCE.indexOf('placeholder="Lesson Title"'),
  );
  assert.ok(
    expectedCompletionIndex > groupingCloseIndex,
    "expected Expected Completion to render after the Lesson Number/Title grouping closes",
  );
});

test("J: the Video/Reading/Quiz content selector remains a three-column grid, unchanged", () => {
  assert.match(SOURCE, /<div className="mt-4 grid grid-cols-3 gap-3">/);
  assert.match(SOURCE, /onClick=\{\(\) => setActiveContentPanel\("video"\)\}/);
  assert.match(SOURCE, /onClick=\{\(\) => setActiveContentPanel\("quiz"\)\}/);
});

test("K/L: the reading write textarea keeps rows={15} and the Kingdom generation textarea keeps rows={10}", () => {
  assert.match(SOURCE, /rows=\{15\}/);
  assert.match(SOURCE, /rows=\{10\}/);
});

test("M/N: the quiz option grid keeps its existing sm:grid-cols-2 layout, and no lg:grid-cols-2 was added to the quiz-question collection itself", () => {
  assert.match(SOURCE, /<div className="mt-3 grid gap-3 sm:grid-cols-2">/);
  const quizCollectionStart = SOURCE.indexOf("{quizQuestions.length > 0 && (");
  const quizCollectionEnd = SOURCE.indexOf(
    "Total Quiz Marks:",
    quizCollectionStart,
  );
  const quizCollectionBlock = SOURCE.slice(quizCollectionStart, quizCollectionEnd);
  assert.doesNotMatch(quizCollectionBlock, /lg:grid-cols-2/);
});

test("O: AccessibilityAudioCard remains imported, referenced and conditionally rendered on readingIsSaved/readingMaterialId/currentLessonId", () => {
  assert.match(
    SOURCE,
    /import \{ AccessibilityAudioCard \} from "@\/components\/subjects\/AccessibilityAudioCard";/,
  );
  assert.match(
    SOURCE,
    /\{readingIsSaved && readingMaterialId && currentLessonId && \(/,
  );
  assert.match(
    SOURCE,
    /<AccessibilityAudioCard\s*\n\s*subjectId=\{subjectId\}\s*\n\s*lessonId=\{currentLessonId\}\s*\n\s*\/>/,
  );
});

test("P: Publish Lesson and Save Changes button text/logic remain present, driven by editingLessonId", () => {
  assert.match(SOURCE, /onClick=\{handlePublishLesson\}/);
  assert.match(
    SOURCE,
    /\{editingLessonId \? "Save Changes" : "Publish Lesson"\}/,
  );
});

test("Q: the Lesson Library section remains after the authoring (Create Lesson) card in source order", () => {
  const createLessonIndex = SOURCE.indexOf("{/* Create Lesson */}");
  const lessonLibraryIndex = SOURCE.indexOf("{/* Published Lessons */}");
  assert.ok(createLessonIndex > -1 && lessonLibraryIndex > -1);
  assert.ok(createLessonIndex < lessonLibraryIndex);
  assert.match(SOURCE, /id="lesson-library"/);
});

test("R: the Term -> Week -> Lesson row structure remains present, driven by the existing controlled openTerm accordion", () => {
  assert.match(SOURCE, /groupedLessons/);
  assert.match(
    SOURCE,
    /setOpenTerm\(\(currentTerm\) =>\s*\n\s*currentTerm === termGroup\.key \? null : termGroup\.key\s*\n\s*\)/,
  );
});

test("S: all six existing Links retain prefetch={false}, and no new Link was added", () => {
  const linkCount = (SOURCE.match(/<Link\b/g) ?? []).length;
  assert.equal(linkCount, 6, "expected exactly 6 Link elements -- no new navigation link was introduced");
  const prefetchCount = (SOURCE.match(/prefetch=\{false\}/g) ?? []).length;
  assert.equal(prefetchCount, 6);
});

test("T: the subject-theme styled-jsx system and its existing orange override coverage remain intact", () => {
  assert.match(SOURCE, /<style jsx global>\{`/);
  assert.match(SOURCE, /"--subject-primary": subject\.colourTheme\.primary,/);
  assert.match(SOURCE, /"--subject-soft": subject\.colourTheme\.softBackground,/);
  assert.match(SOURCE, /"--subject-border": subject\.colourTheme\.border,/);
  assert.match(SOURCE, /\.subject-theme \.bg-orange-500 \{/);
  assert.match(
    SOURCE,
    /\.subject-theme \.bg-orange-50,\s*\n\s*\.subject-theme \.bg-orange-100 \{/,
  );
  assert.match(
    SOURCE,
    /\.subject-theme \.text-orange-500,\s*\n\s*\.subject-theme \.text-orange-600,\s*\n\s*\.subject-theme \.text-orange-700 \{/,
  );
  assert.match(
    SOURCE,
    /\.subject-theme \.border-orange-100,\s*\n\s*\.subject-theme \.border-orange-200 \{/,
  );
});

test("U/V: the bottom navigation keeps its mobile max-w-md base and adds lg:max-w-6xl", () => {
  assert.match(
    SOURCE,
    /<div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">/,
  );
});

test("W: no new sidebar or persistent lesson-navigation column was introduced -- the Lesson Library remains a single accordion below the authoring card", () => {
  assert.doesNotMatch(SOURCE, /lg:flex-row/);
  assert.doesNotMatch(SOURCE, /lg:w-64|lg:w-72|lg:w-80|sidebar/i);
});

test("X: all critical authoring state declarations remain present, unchanged in kind", () => {
  assert.match(SOURCE, /const \[currentLessonId, setCurrentLessonId\] =/);
  assert.match(SOURCE, /const \[editingLessonId, setEditingLessonId\] = useState<string \| null>\(null\);/);
  assert.match(SOURCE, /const \[editingContentBaseline, setEditingContentBaseline\] = useState<\{/);
  assert.match(SOURCE, /const \[activeContentPanel, setActiveContentPanel\] = useState<\s*\n\s*"video" \| "reading" \| "quiz" \| null\s*\n>\(null\);/);
  assert.match(SOURCE, /const \[generatedDraftBaseline, setGeneratedDraftBaseline\] = useState<\s*\n\s*string \| null\s*\n\s*>\(null\);/);
  assert.match(SOURCE, /const \[readingWorkflow, setReadingWorkflow\] = useState<\s*\n\s*"write" \| "pdf" \| "generate" \| null\s*\n\s*>\(null\);/);
  assert.match(SOURCE, /const \[quizQuestions, setQuizQuestions\] =\s*\n\s*useState<LessonQuizQuestion\[\]>\(\[\]\);/);
  assert.match(SOURCE, /const \[openTerm, setOpenTerm\] = useState<string \| null>\(null\);/);
  const useStateCount = (SOURCE.match(/useState[<(]/g) ?? []).length;
  assert.equal(useStateCount, 41, "expected the same useState call count as before this pass -- no state was added or removed");
});

test("Y: existing Kingdom endpoints remain referenced, unchanged", () => {
  assert.match(SOURCE, /"\/api\/kingdom\/generate-lesson-quiz"/);
  assert.match(SOURCE, /"\/api\/kingdom\/structure-reading"/);
  assert.match(SOURCE, /"\/api\/kingdom\/generate-reading"/);
});

test("Z: existing data/service functions remain referenced, unchanged", () => {
  assert.match(SOURCE, /getTeacherPublishedLessonsWithContentSummary/);
  assert.match(SOURCE, /getLessonEditorData/);
  assert.match(SOURCE, /updateLessonStatus/);
  assert.match(SOURCE, /updateLessonDetails/);
  assert.match(SOURCE, /publishLesson\b/);
  assert.match(SOURCE, /publishLessonMaterial/);
  assert.match(SOURCE, /publishLessonQuiz/);
  assert.match(SOURCE, /deleteDraftLesson/);
  assert.match(SOURCE, /createLessonTopic/);
  assert.match(SOURCE, /getLessonTopics/);
});

test("regression: the main element's min-height, background, and pb-24 bottom padding are unchanged", () => {
  assert.match(
    SOURCE,
    /className="subject-theme min-h-screen bg-slate-100 pb-24"/,
  );
});

test("regression: no lg: class was added anywhere outside the four approved locations (outer workspace, modal panel, Lesson Number/Title grouping, bottom nav)", () => {
  const lgMatches = SOURCE.match(/lg:[\w[\]/.-]+/g) ?? [];
  const approved = new Set([
    "lg:max-w-6xl",
    "lg:max-w-4xl",
    "lg:grid",
    "lg:grid-cols-2",
    "lg:gap-3",
    "lg:space-y-0",
  ]);
  const unexpected = lgMatches.filter((match) => !approved.has(match));
  assert.deepEqual(unexpected, [], "expected only the four approved desktop changes' classes to appear");
});
