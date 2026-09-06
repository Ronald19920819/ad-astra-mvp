import assert from "node:assert/strict";
import test from "node:test";

import {
  compareLessonNumbers,
  sortActivityEntriesByCurriculumOrder,
  sortLessonEntriesByCurriculumOrder,
} from "./monthlyReportOrdering";

test("3.1, 3.2, 3.3, 3.9, 3.10, 3.11 sort in exactly that ascending curriculum order", () => {
  const shuffled = ["3.10", "3.2", "3.9", "3.1", "3.11", "3.3"];
  const sorted = [...shuffled].sort(compareLessonNumbers);
  assert.deepEqual(sorted, ["3.1", "3.2", "3.3", "3.9", "3.10", "3.11"]);
});

test("compareLessonNumbers treats 3.10 as strictly after 3.9, never lexically between 3.1 and 3.2", () => {
  assert.ok(compareLessonNumbers("3.9", "3.10") < 0);
  assert.ok(compareLessonNumbers("3.10", "3.2") > 0);
});

test("compareLessonNumbers compares the whole-number part first (e.g. 0.0 before 3.1, 3.13 before 4.1)", () => {
  assert.ok(compareLessonNumbers("0.0", "3.1") < 0);
  assert.ok(compareLessonNumbers("3.13", "4.1") < 0);
});

test("identical lesson numbers compare equal", () => {
  assert.equal(compareLessonNumbers("3.5", "3.5"), 0);
});

test("sortLessonEntriesByCurriculumOrder sorts a realistic shuffled lesson list correctly", () => {
  const lessons = [
    { lessonId: "l-3.10", lessonNumber: "3.10" },
    { lessonId: "l-3.2", lessonNumber: "3.2" },
    { lessonId: "l-3.1", lessonNumber: "3.1" },
    { lessonId: "l-3.9", lessonNumber: "3.9" },
  ];
  const sorted = sortLessonEntriesByCurriculumOrder(lessons);
  assert.deepEqual(
    sorted.map((lesson) => lesson.lessonNumber),
    ["3.1", "3.2", "3.9", "3.10"],
  );
});

test("sortLessonEntriesByCurriculumOrder never sorts by any date/status field -- it does not even accept one", () => {
  // Structural guarantee: the function's generic constraint only allows
  // lessonNumber/lessonId, so a caller cannot accidentally feed it a
  // created_at/status-driven comparator.
  const lessons = [
    { lessonId: "b", lessonNumber: "3.1" },
    { lessonId: "a", lessonNumber: "3.1" },
  ];
  // Same lesson number -- falls back to lessonId for a stable order.
  const sorted = sortLessonEntriesByCurriculumOrder(lessons);
  assert.deepEqual(sorted.map((lesson) => lesson.lessonId), ["a", "b"]);
});

test("sortActivityEntriesByCurriculumOrder sorts activities by their LINKED LESSON's number, never their own due date or submission state", () => {
  const activities = [
    { activityId: "act-3.10", lessonNumber: "3.10" },
    { activityId: "act-3.1", lessonNumber: "3.1" },
    { activityId: "act-3.9", lessonNumber: "3.9" },
  ];
  const sorted = sortActivityEntriesByCurriculumOrder(activities);
  assert.deepEqual(
    sorted.map((activity) => activity.activityId),
    ["act-3.1", "act-3.9", "act-3.10"],
  );
});

test("a shared lesson number between two activities falls back to activityId for a stable, deterministic order", () => {
  const activities = [
    { activityId: "z-activity", lessonNumber: "3.5" },
    { activityId: "a-activity", lessonNumber: "3.5" },
  ];
  const sorted = sortActivityEntriesByCurriculumOrder(activities);
  assert.deepEqual(
    sorted.map((activity) => activity.activityId),
    ["a-activity", "z-activity"],
  );
});

test("sorting never mutates the original array", () => {
  const original = [
    { lessonId: "l-3.2", lessonNumber: "3.2" },
    { lessonId: "l-3.1", lessonNumber: "3.1" },
  ];
  const snapshot = [...original];
  sortLessonEntriesByCurriculumOrder(original);
  assert.deepEqual(original, snapshot);
});
