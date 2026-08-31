import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";

// AD ASTRA PERSONALISED FEEDBACK CARD: a dedicated, deliberately narrow
// reader for the Home dashboard's Teacher Feedback card. This intentionally
// does NOT reuse getLearnerWorkOverview (lib/supabase/learnerWorkReader.ts)
// -- that reader fetches every submission of any status ordered by
// submitted_at, which would overfetch and sort on the wrong timestamp for
// this card. This file selects only "returned" submissions with a
// completed review, ordered by reviewed_at, and only the whole-submission
// teacher_comment -- never per-question activity_submission_answers
// (kingdom_feedback / teacher_feedback), which belong to a different,
// out-of-scope surface.

const RETURNED_FEEDBACK_LIMIT = 8;

export type LearnerReturnedFeedbackItem = {
  submissionId: string;
  subjectId: string;
  subjectName: string;
  activityTitle: string;
  teacherComment: string | null;
  reviewedAt: string;
  finalMark: number;
  totalMarks: number;
  teacherFirstName: string | null;
};

type ReturnedSubmissionRow = {
  id: string;
  activity_id: string;
  reviewed_at: string;
  teacher_comment: string | null;
  final_mark: number | null;
  original_total_marks: number | null;
  reviewed_by: string | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

type ActivityRow = {
  id: string;
  title: string;
  total_marks: number;
  lesson_material_id: string;
};

type MaterialRow = {
  id: string;
  lesson_id: string;
};

type LessonRow = {
  id: string;
  subject_id: string;
};

type ReviewerProfileRow = {
  id: string;
  first_name: string | null;
  full_name: string | null;
};

function isMissingSnapshotColumnError(
  error: { code?: string; message?: string } | null,
) {
  return error?.code === "42703" && error.message?.includes("activity_snapshot");
}

// Mirrors the fallback order already used to resolve a profile's display
// name elsewhere (see lib/profiles/profileIdentity.ts's
// resolveProfileIdentity and subjectTeacherNames.ts's
// resolveTeacherDisplayName): a dedicated first_name column wins; a
// full_name is otherwise split on whitespace for its first token.
function resolveTeacherFirstName(row: ReviewerProfileRow | undefined): string | null {
  if (!row) return null;
  const firstName = row.first_name?.trim();
  if (firstName) return firstName;
  const fullNameFirstToken = row.full_name?.trim().split(/\s+/)[0];
  return fullNameFirstToken || null;
}

export async function getLearnerReturnedFeedback(
  learnerId: string,
): Promise<LearnerReturnedFeedbackItem[]> {
  const supabase = createSupabaseAdminClient();

  let { data: submissionData, error: submissionError } = await supabase
    .from("activity_submissions")
    .select(
      "id, activity_id, reviewed_at, teacher_comment, final_mark, original_total_marks, reviewed_by, activity_snapshot",
    )
    .eq("learner_id", learnerId)
    .eq("status", "returned")
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(RETURNED_FEEDBACK_LIMIT);

  if (isMissingSnapshotColumnError(submissionError)) {
    const legacyResult = await supabase
      .from("activity_submissions")
      .select(
        "id, activity_id, reviewed_at, teacher_comment, final_mark, original_total_marks, reviewed_by",
      )
      .eq("learner_id", learnerId)
      .eq("status", "returned")
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(RETURNED_FEEDBACK_LIMIT);
    submissionData = (legacyResult.data ?? []).map((submission) => ({
      ...submission,
      activity_snapshot: null,
    })) as typeof submissionData;
    submissionError = legacyResult.error;
  }

  if (submissionError) throw submissionError;
  const submissions = ((submissionData ?? []) as ReturnedSubmissionRow[]).filter(
    // The finalize route always sets final_mark atomically with
    // status: "returned" (see the teacher review route's submission
    // update), so this should never trigger in practice -- it exists only
    // as a defensive guard against a submission we could not score.
    (submission) => submission.final_mark !== null,
  );
  if (submissions.length === 0) return [];

  // Only pre-snapshot legacy rows need the live join chain below -- every
  // submission created after the activity_snapshot feature shipped
  // resolves entirely from its own frozen snapshot data.
  const legacySubmissions = submissions.filter(
    (submission) => !isActivitySubmissionSnapshot(submission.activity_snapshot),
  );

  const activityById = new Map<string, ActivityRow>();
  const materialById = new Map<string, MaterialRow>();
  const lessonById = new Map<string, LessonRow>();

  if (legacySubmissions.length > 0) {
    const activityIds = [
      ...new Set(legacySubmissions.map((submission) => submission.activity_id)),
    ];
    const { data: activityData, error: activityError } = await supabase
      .from("activities")
      .select("id, title, total_marks, lesson_material_id")
      .in("id", activityIds);
    if (activityError) throw activityError;
    for (const activity of (activityData ?? []) as ActivityRow[]) {
      activityById.set(activity.id, activity);
    }

    const materialIds = [
      ...new Set(
        [...activityById.values()].map((activity) => activity.lesson_material_id),
      ),
    ];
    if (materialIds.length > 0) {
      const { data: materialData, error: materialError } = await supabase
        .from("lesson_materials")
        .select("id, lesson_id")
        .in("id", materialIds);
      if (materialError) throw materialError;
      for (const material of (materialData ?? []) as MaterialRow[]) {
        materialById.set(material.id, material);
      }

      const lessonIds = [
        ...new Set([...materialById.values()].map((material) => material.lesson_id)),
      ];
      if (lessonIds.length > 0) {
        const { data: lessonData, error: lessonError } = await supabase
          .from("lessons")
          .select("id, subject_id")
          .in("id", lessonIds);
        if (lessonError) throw lessonError;
        for (const lesson of (lessonData ?? []) as LessonRow[]) {
          lessonById.set(lesson.id, lesson);
        }
      }
    }
  }

  const reviewerProfileIds = [
    ...new Set(
      submissions
        .map((submission) => submission.reviewed_by)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];

  const teacherFirstNameById = new Map<string, string | null>();
  if (reviewerProfileIds.length > 0) {
    const { data: reviewerData, error: reviewerError } = await supabase
      .from("profiles")
      .select("id, first_name, full_name")
      .in("id", reviewerProfileIds);
    if (reviewerError) throw reviewerError;
    for (const row of (reviewerData ?? []) as ReviewerProfileRow[]) {
      teacherFirstNameById.set(row.id, resolveTeacherFirstName(row));
    }
  }

  return submissions.flatMap((submission): LearnerReturnedFeedbackItem[] => {
    // Filtered above -- final_mark is guaranteed non-null here.
    const finalMark = submission.final_mark as number;
    const teacherFirstName = submission.reviewed_by
      ? teacherFirstNameById.get(submission.reviewed_by) ?? null
      : null;

    if (isActivitySubmissionSnapshot(submission.activity_snapshot)) {
      const snapshot = submission.activity_snapshot;
      const totalMarks = submission.original_total_marks ?? snapshot.activity.totalMarks;

      return [
        {
          submissionId: submission.id,
          subjectId: snapshot.subject.id,
          subjectName: snapshot.subject.name,
          activityTitle: snapshot.activity.title,
          teacherComment: submission.teacher_comment,
          reviewedAt: submission.reviewed_at,
          finalMark,
          totalMarks,
          teacherFirstName,
        },
      ];
    }

    const activity = activityById.get(submission.activity_id);
    if (!activity) return [];
    const material = materialById.get(activity.lesson_material_id);
    if (!material) return [];
    const lesson = lessonById.get(material.lesson_id);
    if (!lesson) return [];
    const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
    const totalMarks = submission.original_total_marks ?? activity.total_marks;

    return [
      {
        submissionId: submission.id,
        subjectId: lesson.subject_id,
        subjectName: subject?.displayName ?? "Subject",
        activityTitle: activity.title,
        teacherComment: submission.teacher_comment,
        reviewedAt: submission.reviewed_at,
        finalMark,
        totalMarks,
        teacherFirstName,
      },
    ];
  });
}
