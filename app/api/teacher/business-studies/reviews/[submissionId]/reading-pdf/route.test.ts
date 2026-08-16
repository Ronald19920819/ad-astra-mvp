import assert from "node:assert/strict";
import test from "node:test";
import { createActivitySubmissionSnapshot } from "@/lib/activities/activitySnapshot";
import {
  buildActivitySubmissionPdfSnapshotPath,
  isActivitySubmissionPdfSnapshotPath,
} from "@/lib/activities/activitySnapshotPdf";
import {
  getSubjectConfigurationByDatabaseId,
  subjectConfigurations,
} from "@/lib/subjects/subjectConfig";

// This route (app/api/teacher/business-studies/reviews/[submissionId]/reading-pdf/route.ts)
// imports "server-only" through lib/supabase/teacherAuth.ts, which cannot be
// loaded outside a Next.js server bundle, so the route handler itself cannot
// be invoked directly in a plain node:test run. Instead, these tests exercise
// the exact security-critical predicates the route relies on, using the real
// (unmodified) helper functions it calls:
//
//   1. subjectId validation: getSubjectConfigurationByDatabaseId(subjectId)
//   2. the snapshot-access guard, mirrored verbatim from route.ts:60-71:
//        !snapshot ||
//        snapshot.subject.id !== subjectId ||
//        snapshot.reading.sourceType !== "pdf" ||
//        typeof snapshot.reading.pdfStoragePath !== "string" ||
//        !isActivitySubmissionPdfSnapshotPath(snapshot.reading.pdfStoragePath, learnerId, snapshot.activity.id)
//
// Case G ("teacher not authorized for the requested subject -> rejected") is
// enforced entirely by the pre-existing, unmodified authorizeTeacher(subjectId)
// function, which the fix now calls with the real dynamic subjectId instead of
// a hardcoded one -- authorizeTeacher's own subject-scoping behavior is
// unchanged by this fix and is not re-tested here.

const learnerId = "5f119c26-f70e-47ac-8696-0f453069dda4";

function buildPdfSnapshot(subjectId: string, subjectName: string) {
  const activityId = "b4db3f3c-4fc9-4551-975f-aa566429044b";
  const pdfStoragePath = buildActivitySubmissionPdfSnapshotPath(learnerId, activityId);

  const snapshot = createActivitySubmissionSnapshot({
    submittedAt: "2026-08-16T14:48:59.409Z",
    activity: {
      id: activityId,
      version: 1,
      title: "Activity 7",
      instructions: null,
      totalMarks: 18,
      dueDate: null,
    },
    subject: { id: subjectId, name: subjectName },
    lesson: {
      id: "d80018a2-94cb-4986-97b3-e1e6f38503d8",
      title: "Lesson 3.7",
      lessonNumber: "3.7",
      termNumber: 3,
      weekNumber: 7,
    },
    reading: {
      id: "d80018a2-94cb-4986-97b3-e1e6f38503d8",
      title: "Reading",
      sourceType: "pdf",
      contentText: "",
      pdfStoragePath,
    },
    questions: [
      {
        id: "29c4c1ba-acff-47b6-83b9-4631f1c2efcf",
        questionNumber: 1,
        displayOrder: 1,
        paper: null,
        questionType: null,
        questionText: "Question 1",
        marks: 5,
        assessmentObjective: null,
        guidance: null,
      },
    ],
  });

  return { snapshot, learnerId, pdfStoragePath };
}

// Mirrors route.ts's guard exactly (see file-level comment above).
function isPdfAccessible(
  subjectId: string,
  learnerIdForSnapshot: string,
  snapshot: ReturnType<typeof buildPdfSnapshot>["snapshot"] | null,
) {
  return !(
    !snapshot ||
    snapshot.subject.id !== subjectId ||
    snapshot.reading.sourceType !== "pdf" ||
    typeof snapshot.reading.pdfStoragePath !== "string" ||
    !isActivitySubmissionPdfSnapshotPath(
      snapshot.reading.pdfStoragePath,
      learnerIdForSnapshot,
      snapshot.activity.id,
    )
  );
}

test("H: an invalid subjectId is rejected before any snapshot check", () => {
  assert.equal(getSubjectConfigurationByDatabaseId("not-a-real-uuid"), undefined);
  assert.equal(
    getSubjectConfigurationByDatabaseId("11111111-1111-1111-1111-111111111111"),
    undefined,
  );
});

test("A: canonical Business Studies teacher viewing a canonical Business Studies submission is allowed", () => {
  const businessStudies = subjectConfigurations["business-studies"];
  const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
    businessStudies.databaseId,
    businessStudies.displayName,
  );

  assert.ok(getSubjectConfigurationByDatabaseId(businessStudies.databaseId));
  assert.equal(isPdfAccessible(businessStudies.databaseId, snapshotLearnerId, snapshot), true);
});

test("B: Business Studies IGCSE 1 teacher viewing an IGCSE 1 submission is allowed", () => {
  const igcse1 = subjectConfigurations["business-studies-igcse-1"];
  const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
    igcse1.databaseId,
    igcse1.displayName,
  );

  assert.ok(getSubjectConfigurationByDatabaseId(igcse1.databaseId));
  assert.equal(isPdfAccessible(igcse1.databaseId, snapshotLearnerId, snapshot), true);
});

test("C: History teacher viewing a History submission is allowed", () => {
  const history = subjectConfigurations["history"];
  const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
    history.databaseId,
    history.displayName,
  );

  assert.equal(isPdfAccessible(history.databaseId, snapshotLearnerId, snapshot), true);
});

test("D: English teacher viewing a matching English submission is allowed (both stages)", () => {
  for (const key of ["english", "english-stage-8"] as const) {
    const english = subjectConfigurations[key];
    const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
      english.databaseId,
      english.displayName,
    );

    assert.equal(isPdfAccessible(english.databaseId, snapshotLearnerId, snapshot), true);
  }
});

test("E: Afrikaans teacher viewing a matching Afrikaans submission is allowed (both stages)", () => {
  for (const key of ["afrikaans", "afrikaans-stage-8"] as const) {
    const afrikaans = subjectConfigurations[key];
    const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
      afrikaans.databaseId,
      afrikaans.displayName,
    );

    assert.equal(isPdfAccessible(afrikaans.databaseId, snapshotLearnerId, snapshot), true);
  }
});

test("F: a subjectId that does not match the snapshot's actual subject is rejected", () => {
  const history = subjectConfigurations["history"];
  const english = subjectConfigurations["english"];
  const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
    history.databaseId,
    history.displayName,
  );

  // A teacher authorized for English tries to view a History submission by
  // swapping the subjectId in the request -- must still be rejected because
  // the immutable snapshot's own subject does not match.
  assert.equal(isPdfAccessible(english.databaseId, snapshotLearnerId, snapshot), false);
});

test("previously-broken cases: every non-canonical subject used to be rejected against the old hardcoded check", () => {
  const businessStudies = subjectConfigurations["business-studies"];

  for (const key of [
    "business-studies-igcse-1",
    "history",
    "history-igcse-1",
    "english",
    "english-stage-8",
    "afrikaans",
    "afrikaans-stage-8",
  ] as const) {
    const subject = subjectConfigurations[key];
    const { snapshot, learnerId: snapshotLearnerId } = buildPdfSnapshot(
      subject.databaseId,
      subject.displayName,
    );

    // Old behavior (route.ts before the fix): always compared against
    // businessStudiesSubject.databaseId, so every one of these would fail.
    assert.equal(
      isPdfAccessible(businessStudies.databaseId, snapshotLearnerId, snapshot),
      false,
      `${key} snapshot must not be accessible under the old hardcoded businessStudies subjectId`,
    );

    // New behavior: accessible when authorized/requested with its own real subjectId.
    assert.equal(
      isPdfAccessible(subject.databaseId, snapshotLearnerId, snapshot),
      true,
      `${key} snapshot must be accessible under its own real subjectId`,
    );
  }
});

test("I: a text-reading (non-PDF) snapshot is rejected", () => {
  const history = subjectConfigurations["history"];
  const activityId = "b4db3f3c-4fc9-4551-975f-aa566429044b";

  const snapshot = createActivitySubmissionSnapshot({
    submittedAt: "2026-08-16T14:48:59.409Z",
    activity: {
      id: activityId,
      version: 1,
      title: "Activity 7",
      instructions: null,
      totalMarks: 18,
      dueDate: null,
    },
    subject: { id: history.databaseId, name: history.displayName },
    lesson: {
      id: "d80018a2-94cb-4986-97b3-e1e6f38503d8",
      title: "Lesson 3.7",
      lessonNumber: "3.7",
      termNumber: 3,
      weekNumber: 7,
    },
    reading: {
      id: "d80018a2-94cb-4986-97b3-e1e6f38503d8",
      title: "Reading",
      sourceType: "pasted_text",
      contentText: "Some plain text reading content.",
      pdfStoragePath: null,
    },
    questions: [
      {
        id: "29c4c1ba-acff-47b6-83b9-4631f1c2efcf",
        questionNumber: 1,
        displayOrder: 1,
        paper: null,
        questionType: null,
        questionText: "Question 1",
        marks: 5,
        assessmentObjective: null,
        guidance: null,
      },
    ],
  });

  assert.equal(isPdfAccessible(history.databaseId, learnerId, snapshot), false);
});

test("I: a PDF snapshot whose stored path does not belong to it is rejected", () => {
  const history = subjectConfigurations["history"];
  const { snapshot } = buildPdfSnapshot(history.databaseId, history.displayName);

  // Path belongs to a different learner than the one recorded on the submission.
  const wrongLearnerId = "17a71958-5d5e-47b1-889c-99703008c11d";
  assert.equal(isPdfAccessible(history.databaseId, wrongLearnerId, snapshot), false);
});
