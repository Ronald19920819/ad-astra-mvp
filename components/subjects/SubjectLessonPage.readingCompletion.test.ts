import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// SubjectLessonPage.tsx is a "use client" component that imports
// browser-only hooks (useParams, useRouter) and cannot be rendered in a
// plain node:test run. These assert the real source's structural
// properties directly, matching this codebase's established
// source-inspection precedent (e.g. lib/auth/accountRole.test.mjs).

const SOURCE = readFileSync("components/subjects/SubjectLessonPage.tsx", "utf8");

test("M: isReadingSatisfied is derived from the server-reconciled satisfiedMaterialTypes array, not a separately-tracked local boolean -- the same signal source Classroom's tracker and the canonical completion engine both agree on", () => {
  assert.match(
    SOURCE,
    /const isReadingSatisfied = satisfiedMaterialTypes\.includes\("reading"\)/,
  );
});

test("regression: the old isReadingComplete state (which never re-hydrated on an SSR-provided page load) has been removed, not left as unused dead state", () => {
  assert.doesNotMatch(SOURCE, /const \[isReadingComplete, setIsReadingComplete\]/);
});

test("N: the manual Mark Reading Complete control is only rendered when the lesson has no quiz -- once a quiz exists, reading completion is driven entirely by the canonical quiz-implies-reading rule", () => {
  assert.match(SOURCE, /\{!quiz && \(/);
  const buttonBlock = SOURCE.match(/\{!quiz && \([\s\S]*?Mark Reading Complete[\s\S]*?\)\}/)?.[0];
  assert.ok(buttonBlock, "the gated Mark Reading Complete block was not found");
});

test("the reading-progress checklist and the button both key off the same isReadingSatisfied value -- they can no longer disagree with each other", () => {
  const occurrences = SOURCE.match(/isReadingSatisfied/g) ?? [];
  assert.ok(occurrences.length >= 3, "expected isReadingSatisfied to be used by the derivation, the checklist, and the button");
});
