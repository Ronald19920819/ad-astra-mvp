import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  answersRecordFromDraft,
  buildActivityDraftCacheKey,
  choosePreferredDraftSource,
  reconcileAnswersForQuestionIds,
} from "./activityDrafts.ts";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/202608040002_learner_activity_drafts.sql",
);

test("draft cache keys are scoped by learner, subject, and activity", () => {
  assert.equal(
    buildActivityDraftCacheKey({
      learnerId: "learner-1",
      subjectId: "subject-1",
      activityId: "activity-1",
    }),
    "ad-astra:activity-draft:learner-1:subject-1:activity-1",
  );
});

test("draft answers reconcile by stable question id", () => {
  assert.deepEqual(
    reconcileAnswersForQuestionIds(["q1", "q3"], {
      q1: "Answer 1",
      q2: "Removed question",
      q3: "Answer 3",
    }),
    {
      q1: "Answer 1",
      q3: "Answer 3",
    },
  );
});

test("server draft wins when its revision is newer", () => {
  const decision = choosePreferredDraftSource({
    serverDraft: {
      id: "draft-1",
      activityId: "activity-1",
      learnerId: "learner-1",
      subjectId: "subject-1",
      activityVersion: 2,
      revision: 4,
      updatedAt: "2026-08-04T10:00:00.000Z",
      answers: [{ questionId: "q1", answerText: "Server" }],
    },
    localDraft: {
      learnerId: "learner-1",
      subjectId: "subject-1",
      activityId: "activity-1",
      activityVersion: 2,
      revision: 3,
      updatedAt: "2026-08-04T09:00:00.000Z",
      answers: { q1: "Local" },
      dirty: true,
    },
  });

  assert.deepEqual(decision, {
    winner: "server",
    newerDraftFound: true,
  });
});

test("local draft answers convert into the current answer record", () => {
  assert.deepEqual(
    answersRecordFromDraft([
      { questionId: "q1", answerText: "A" },
      { questionId: "q2", answerText: "B" },
    ]),
    {
      q1: "A",
      q2: "B",
    },
  );
});

test("draft migration creates secure learner activity draft storage", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(migration, /create table if not exists public\.learner_activity_drafts/i);
  assert.match(
    migration,
    /create table if not exists public\.learner_activity_draft_answers/i,
  );
  assert.match(migration, /revision integer not null default 1/i);
  assert.match(
    migration,
    /create policy "Learners can read their own activity drafts"/i,
  );
  assert.match(
    migration,
    /create policy "Learners can read their own activity draft answers"/i,
  );
  assert.match(migration, /save_learner_activity_draft/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
});
