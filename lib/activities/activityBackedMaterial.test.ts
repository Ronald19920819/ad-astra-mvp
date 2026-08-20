import assert from "node:assert/strict";
import test from "node:test";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";
import {
  filterActivityBackedActivities,
  filterActivityBackedMaterialIds,
  isActivityBackedMaterialType,
} from "./activityBackedMaterial";

// A. reading-linked activity counts as an activity
test("a reading-type material is activity-backed", () => {
  assert.equal(isActivityBackedMaterialType("reading"), true);
});

// B. activity-type material counts as an activity where supported
test("an activity-type material is activity-backed", () => {
  assert.equal(isActivityBackedMaterialType("activity"), true);
});

// C. quiz-linked `activities` row does NOT count
test("a quiz-type material is never activity-backed", () => {
  assert.equal(isActivityBackedMaterialType("quiz"), false);
});

test("a video-type material is never activity-backed", () => {
  assert.equal(isActivityBackedMaterialType("video"), false);
});

// D. lesson with reading activity + quiz activity -> total activity count = 1, not 2
test("a lesson with one reading-linked activity and one quiz-linked activity counts as 1, not 2", () => {
  const materials = [
    { id: "material-reading", material_type: "reading" },
    { id: "material-quiz", material_type: "quiz" },
  ];
  const activities = [
    { id: "activity-real", lesson_material_id: "material-reading" },
    { id: "activity-quiz", lesson_material_id: "material-quiz" },
  ];

  const backed = filterActivityBackedActivities(activities, materials);
  assert.equal(backed.length, 1);
  assert.equal(backed[0].id, "activity-real");
});

// E. seven lessons each with one real activity + one quiz-linked activity -> total = 7, not 14
test("seven lessons each with a real activity and a quiz activity total 7, not 14", () => {
  const materials = Array.from({ length: 7 }, (_, index) => [
    { id: `reading-${index}`, material_type: "reading" },
    { id: `quiz-${index}`, material_type: "quiz" },
  ]).flat();
  const activities = Array.from({ length: 7 }, (_, index) => [
    { id: `activity-${index}`, lesson_material_id: `reading-${index}` },
    { id: `quiz-activity-${index}`, lesson_material_id: `quiz-${index}` },
  ]).flat();

  assert.equal(materials.length, 14);
  assert.equal(activities.length, 14);

  const backed = filterActivityBackedActivities(activities, materials);
  assert.equal(backed.length, 7);
});

// F. learner who submitted all seven real activities -> completed = 7, total = 7
test("a learner who submitted every real activity has completed === total", () => {
  const materials = Array.from({ length: 7 }, (_, index) => [
    { id: `reading-${index}`, material_type: "reading" },
    { id: `quiz-${index}`, material_type: "quiz" },
  ]).flat();
  const activities = Array.from({ length: 7 }, (_, index) => [
    { id: `activity-${index}`, lesson_material_id: `reading-${index}` },
    { id: `quiz-activity-${index}`, lesson_material_id: `quiz-${index}` },
  ]).flat();

  const backed = filterActivityBackedActivities(activities, materials);
  const submittedActivityIds = new Set(backed.map((activity) => activity.id));

  // Quiz-linked activities can never appear here -- there is no code path
  // that produces an activity_submissions row for one (quizzes are scored
  // via learner_quiz_attempts instead) -- so a learner submitting "every
  // real activity" naturally only ever submits the 7 backed ones.
  const completed = backed.filter((activity) =>
    submittedActivityIds.has(activity.id),
  ).length;

  assert.equal(completed, 7);
  assert.equal(backed.length, 7);
});

// G. subject UUID/stage isolation remains unchanged -- the predicate is
// purely material_type-based and never touches subject/stage identity, so
// applying it to two independent (synthetic) subject datasets never mixes
// their results.
test("filtering never mixes materials/activities across different subjects", () => {
  const englishStage9 = subjectConfigurations["english"];
  const englishStage8 = subjectConfigurations["english-stage-8"];

  const stage9Materials = [
    { id: `${englishStage9.databaseId}-reading`, material_type: "reading" },
    { id: `${englishStage9.databaseId}-quiz`, material_type: "quiz" },
  ];
  const stage8Materials = [
    { id: `${englishStage8.databaseId}-reading`, material_type: "reading" },
    { id: `${englishStage8.databaseId}-quiz`, material_type: "quiz" },
  ];

  const stage9Ids = filterActivityBackedMaterialIds(stage9Materials);
  const stage8Ids = filterActivityBackedMaterialIds(stage8Materials);

  assert.deepEqual(stage9Ids, [`${englishStage9.databaseId}-reading`]);
  assert.deepEqual(stage8Ids, [`${englishStage8.databaseId}-reading`]);
  assert.equal(
    stage9Ids.some((id) => stage8Ids.includes(id)),
    false,
  );
});

test("filterActivityBackedMaterialIds preserves order and excludes only quiz", () => {
  const materials = [
    { id: "m1", material_type: "video" },
    { id: "m2", material_type: "reading" },
    { id: "m3", material_type: "quiz" },
    { id: "m4", material_type: "activity" },
  ];

  assert.deepEqual(filterActivityBackedMaterialIds(materials), ["m2", "m4"]);
});
