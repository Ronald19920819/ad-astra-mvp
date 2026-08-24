import "server-only";

import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";
import {
  isLearnerActivitySubmittedStatus,
  type LearnerActivitySubmissionStatus,
} from "@/lib/activities/learnerActivityStatus";
import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getLearnerWorkOverview, type LearnerWorkSummary } from "@/lib/supabase/learnerWorkReader";

export type OutstandingLessonItem = {
  kind: "lesson";
  id: string;
  title: string;
  lessonNumber: string;
  dueDate: string | null;
  isOverdue: boolean;
  termNumber: number | null;
  weekNumber: number | null;
  displayOrder: number | null;
};

export type OutstandingActivityItem = {
  kind: "activity";
  id: string;
  title: string;
  totalMarks: number;
  lessonId: string;
  lessonNumber: string;
  dueDate: string | null;
  isOverdue: boolean;
  termNumber: number | null;
  weekNumber: number | null;
  displayOrder: number | null;
};

export type CompletedLessonItem = {
  id: string;
  title: string;
  lessonNumber: string;
  completedAt: string;
};

export type OutstandingWorkItem = OutstandingLessonItem | OutstandingActivityItem;

export type LearnerSubjectWorkStatus = {
  completedActivities: LearnerWorkSummary[];
  completedLessons: CompletedLessonItem[];
  outstandingLessons: OutstandingLessonItem[];
  outstandingActivities: OutstandingActivityItem[];
  // outstandingLessons and outstandingActivities merged into one
  // academic-progression-ordered list, for a single combined "what's next"
  // view -- computed once here so callers never need to re-merge/re-sort.
  outstandingItems: OutstandingWorkItem[];
};

type LessonRow = {
  id: string;
  lesson_number: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  display_order: number | null;
  expected_completion_date: string | null;
};
type MaterialRow = { id: string; lesson_id: string; material_type: string };
type ActivityRow = {
  id: string;
  lesson_material_id: string;
  title: string;
  total_marks: number;
  due_date: string | null;
};
type SubmissionRow = {
  activity_id: string;
  status: LearnerActivitySubmissionStatus;
};
type CompletionRow = { lesson_id: string; completed_at: string };

function academicOrderComparator(
  a: { termNumber: number | null; weekNumber: number | null; displayOrder: number | null; lessonNumber: string },
  b: { termNumber: number | null; weekNumber: number | null; displayOrder: number | null; lessonNumber: string },
) {
  const termA = a.termNumber ?? Number.POSITIVE_INFINITY;
  const termB = b.termNumber ?? Number.POSITIVE_INFINITY;
  if (termA !== termB) return termA - termB;

  const weekA = a.weekNumber ?? Number.POSITIVE_INFINITY;
  const weekB = b.weekNumber ?? Number.POSITIVE_INFINITY;
  if (weekA !== weekB) return weekA - weekB;

  const orderA = a.displayOrder ?? Number.POSITIVE_INFINITY;
  const orderB = b.displayOrder ?? Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;

  return a.lessonNumber.localeCompare(b.lessonNumber, "en-ZA", { numeric: true });
}

// Single-learner, single-subject slice of the same canonical tables the
// teacher tracker reads (lib/supabase/learningTrackerReader.ts) -- reuses
// the exact same predicates (filterActivityBackedMaterialIds,
// isLearnerActivitySubmittedStatus) rather than re-deriving completion
// logic. A lesson counts as complete purely by the existence of a
// learner_lesson_completions row -- the canonical adaptive completion
// write path (lib/lessons/lessonCompletionService.ts) is what populates
// that row; this reader never re-evaluates the predicate itself.
export async function getLearnerSubjectWorkStatus(
  learnerAuthUserId: string,
  subjectDatabaseId: string,
): Promise<LearnerSubjectWorkStatus> {
  const supabase = createSupabaseAdminClient();

  const [lessonsResult, workOverview] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, lesson_number, title, term_number, week_number, display_order, expected_completion_date",
      )
      .eq("subject_id", subjectDatabaseId)
      .eq("status", "published"),
    getLearnerWorkOverview(learnerAuthUserId),
  ]);

  if (lessonsResult.error) throw lessonsResult.error;
  const lessons = (lessonsResult.data ?? []) as LessonRow[];
  const completedActivities = workOverview.filter(
    (submission) => submission.subject.id === subjectDatabaseId,
  );

  if (lessons.length === 0) {
    return {
      completedActivities,
      completedLessons: [],
      outstandingLessons: [],
      outstandingActivities: [],
      outstandingItems: [],
    };
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  const [materialsResult, completionsResult] = await Promise.all([
    supabase
      .from("lesson_materials")
      .select("id, lesson_id, material_type")
      .in("lesson_id", lessonIds),
    supabase
      .from("learner_lesson_completions")
      .select("lesson_id, completed_at")
      .eq("learner_id", learnerAuthUserId)
      .in("lesson_id", lessonIds),
  ]);

  if (materialsResult.error) throw materialsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const completions = (completionsResult.data ?? []) as CompletionRow[];
  const completionByLessonId = new Map(
    completions.map((completion) => [completion.lesson_id, completion]),
  );

  // Only reading/activity-type materials can back a genuine learner
  // activity -- excludes quiz-linked materials, matching every other
  // reader that counts activities (lib/activities/activityBackedMaterial.ts).
  const activityMaterialIds = filterActivityBackedMaterialIds(materials);
  const materialLessonIds = new Map(
    materials.map((material) => [material.id, material.lesson_id]),
  );

  let activities: ActivityRow[] = [];
  if (activityMaterialIds.length > 0) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, lesson_material_id, title, total_marks, due_date")
      .in("lesson_material_id", activityMaterialIds);
    if (error) throw error;
    activities = (data ?? []) as ActivityRow[];
  }

  let submissions: SubmissionRow[] = [];
  if (activities.length > 0) {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select("activity_id, status")
      .eq("learner_id", learnerAuthUserId)
      .in(
        "activity_id",
        activities.map((activity) => activity.id),
      );
    if (error) throw error;
    submissions = (data ?? []) as SubmissionRow[];
  }
  const submissionByActivityId = new Map(
    submissions.map((submission) => [submission.activity_id, submission]),
  );

  const completedLessons: CompletedLessonItem[] = [];
  const outstandingLessons: OutstandingLessonItem[] = [];

  for (const lesson of lessons) {
    const completion = completionByLessonId.get(lesson.id);
    if (completion) {
      completedLessons.push({
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lesson.lesson_number,
        completedAt: completion.completed_at,
      });
    } else {
      outstandingLessons.push({
        kind: "lesson",
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lesson.lesson_number,
        dueDate: lesson.expected_completion_date,
        isOverdue: isDateOverdue(lesson.expected_completion_date),
        termNumber: lesson.term_number,
        weekNumber: lesson.week_number,
        displayOrder: lesson.display_order,
      });
    }
  }

  const outstandingActivities: OutstandingActivityItem[] = activities.flatMap(
    (activity) => {
      const submission = submissionByActivityId.get(activity.id);
      if (submission && isLearnerActivitySubmittedStatus(submission.status)) {
        return [];
      }

      const lessonId = materialLessonIds.get(activity.lesson_material_id);
      const lesson = lessonId ? lessonById.get(lessonId) : undefined;
      if (!lesson) return [];

      return [
        {
          kind: "activity" as const,
          id: activity.id,
          title: activity.title,
          totalMarks: activity.total_marks,
          lessonId: lesson.id,
          lessonNumber: lesson.lesson_number,
          dueDate: activity.due_date,
          isOverdue: isDateOverdue(activity.due_date),
          termNumber: lesson.term_number,
          weekNumber: lesson.week_number,
          displayOrder: lesson.display_order,
        },
      ];
    },
  );

  outstandingLessons.sort(academicOrderComparator);
  outstandingActivities.sort(academicOrderComparator);

  const outstandingItems: OutstandingWorkItem[] = [
    ...outstandingLessons,
    ...outstandingActivities,
  ].sort(academicOrderComparator);

  return {
    completedActivities,
    completedLessons,
    outstandingLessons,
    outstandingActivities,
    outstandingItems,
  };
}
