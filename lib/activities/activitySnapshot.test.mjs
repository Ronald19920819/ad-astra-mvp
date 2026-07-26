import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createActivitySubmissionSnapshot,
  isActivitySubmissionSnapshot,
  shouldWarnBeforeActivityEdit,
  snapshotQuestionById,
} from "./activitySnapshot.ts";

function createSnapshot() {
  return createActivitySubmissionSnapshot({
    submittedAt: "2026-07-26T10:00:00.000Z",
    activity: {
      id: "activity-1",
      version: 1,
      title: "Activity 2 – Market Research",
      instructions: "Answer every question.",
      totalMarks: 20,
      dueDate: "2026-07-30",
    },
    subject: { id: "subject-1", name: "Business Studies" },
    lesson: {
      id: "lesson-1",
      title: "Market Research",
      lessonNumber: "3.1",
      termNumber: 3,
      weekNumber: 1,
    },
    reading: {
      id: "reading-1",
      title: "Market Research",
      contentText:
        "Primary and secondary research provide different evidence.",
    },
    questions: [
      {
        id: "question-1",
        questionNumber: 1,
        displayOrder: 1,
        paper: "Paper 1",
        questionType: "short_answer",
        questionText: "Define primary research.",
        marks: 2,
        assessmentObjective: "AO1",
        guidance: "Give a clear definition.",
      },
      {
        id: "question-2",
        questionNumber: 2,
        displayOrder: 2,
        paper: "Paper 1",
        questionType: "extended_response",
        questionText: "Explain one benefit of primary research.",
        marks: 4,
        assessmentObjective: "AO2",
        guidance: null,
      },
    ],
  });
}

test("a submission snapshot preserves the exact submitted title and total", () => {
  const snapshot = createSnapshot();

  assert.equal(snapshot.activity.title, "Activity 2 – Market Research");
  assert.equal(snapshot.activity.totalMarks, 20);
  assert.equal(snapshot.activity.version, 1);
  assert.equal(isActivitySubmissionSnapshot(snapshot), true);
});

test("later live edits cannot mutate the captured snapshot evidence", () => {
  const source = createSnapshot();
  const editedLiveQuestions = source.questions.map((question) => ({
    ...question,
  }));

  editedLiveQuestions[0].questionText = "Changed live wording";
  editedLiveQuestions.reverse();
  editedLiveQuestions.pop();

  assert.equal(
    snapshotQuestionById(source).get("question-1")?.questionText,
    "Define primary research.",
  );
  assert.deepEqual(
    source.questions.map((question) => question.id),
    ["question-1", "question-2"],
  );
});

test("different learners can retain independent activity versions", () => {
  const versionOne = createSnapshot();
  const versionTwo = createActivitySubmissionSnapshot({
    ...versionOne,
    activity: {
      ...versionOne.activity,
      version: 2,
      title: "Activity 2 – Updated Market Research",
      totalMarks: 25,
    },
    questions: [
      ...versionOne.questions,
      {
        id: "question-3",
        questionNumber: 3,
        displayOrder: 3,
        paper: "Paper 1",
        questionType: "extended_response",
        questionText: "Evaluate a suitable research method.",
        marks: 5,
        assessmentObjective: "AO3",
        guidance: null,
      },
    ],
  });

  assert.equal(versionOne.activity.title, "Activity 2 – Market Research");
  assert.equal(versionOne.activity.totalMarks, 20);
  assert.equal(versionTwo.activity.version, 2);
  assert.equal(versionTwo.activity.totalMarks, 25);
  assert.equal(versionTwo.questions.length, 3);
});

test("teacher edit warnings appear only when submissions exist", () => {
  assert.equal(shouldWarnBeforeActivityEdit(0), false);
  assert.equal(shouldWarnBeforeActivityEdit(1), true);
  assert.equal(shouldWarnBeforeActivityEdit(4), true);
});

test("the migration enforces immutable, atomic snapshot creation", () => {
  const migration = readFileSync(
    "supabase/migrations/202607260002_activity_submission_snapshots.sql",
    "utf8",
  );

  assert.match(migration, /protect_activity_submission_snapshot/);
  assert.match(migration, /Activity submission snapshots are immutable/);
  assert.match(migration, /create_activity_submission_snapshot/);
  assert.match(migration, /for share/);
  assert.match(migration, /activity_snapshot/);
  assert.match(migration, /original_total_marks/);
  assert.match(migration, /submitted_activity_version/);
  assert.match(
    migration,
    /p_snapshot #>> '\{activity,title\}'.*<> current_title/s,
  );
});

test("snapshot write RPCs are unavailable to browser roles", () => {
  const migration = readFileSync(
    "supabase/migrations/202607260002_activity_submission_snapshots.sql",
    "utf8",
  );

  assert.match(
    migration,
    /revoke all on function public\.create_activity_submission_snapshot[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.update_activity_material_version[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_activity_submission_snapshot[\s\S]*to service_role/,
  );
});

test("a material version mismatch uses the learner-friendly reload response", () => {
  const submissionRoute = readFileSync(
    "app/api/kingdom/mark-activity/route.ts",
    "utf8",
  );

  assert.match(
    submissionRoute,
    /ACTIVITY_UPDATED_RELOAD_REQUIRED/,
  );
  assert.match(
    submissionRoute,
    /updated by your teacher after you opened it\. Reload the activity and review the latest questions before submitting\./,
  );
});
