import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";

export type TeacherActivityReviewSubmission = {
  id: string;
  learnerName: string;
  status: string;
  preliminaryMark: number | null;
  preliminaryTotal: number | null;
  finalMark: number | null;
};

export type TeacherActivityReview = {
  id: string;
  title: string;
  totalMarks: number;
  termNumber: number | null;
  weekNumber: number | null;
  createdAt: string;
  submissions: TeacherActivityReviewSubmission[];
};

type ActivityReviewRow = {
  id: string;
  title: string;
  created_at: string;
  activity_questions: { marks: number }[];
  lesson_materials: {
    lessons: {
      term_number: number | null;
      week_number: number | null;
    };
  };
};

type SubmissionRow = {
  id: string;
  activity_id: string;
  learner_id: string;
  status: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  final_mark: number | null;
};

export async function getBusinessStudiesActivityReviews(): Promise<
  TeacherActivityReview[]
> {
  const supabase = createSupabaseAdminClient();
  const { data: activityData, error: activitiesError } = await supabase
    .from("activities")
    .select(`
      id,
      title,
      created_at,
      activity_questions (
        marks
      ),
      lesson_materials!inner (
        material_type,
        lessons!inner (
          term_number,
          week_number,
          subject_id,
          status
        )
      )
    `)
    .in("lesson_materials.material_type", ["activity", "reading"])
    .eq("lesson_materials.lessons.subject_id", businessStudiesSubjectId)
    .eq("lesson_materials.lessons.status", "published")
    .order("created_at", { ascending: false });

  if (activitiesError) throw activitiesError;

  const activities = (activityData ?? []) as unknown as ActivityReviewRow[];
  const activityIds = activities.map((activity) => activity.id);
  let submissions: SubmissionRow[] = [];

  if (activityIds.length > 0) {
    const { data, error } = await supabase
      .from("activity_submissions")
      .select(`
        id,
        activity_id,
        learner_id,
        status,
        preliminary_mark,
        preliminary_total,
        final_mark
      `)
      .in("activity_id", activityIds)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    submissions = data ?? [];
  }

  const learnerIds = [
    ...new Set(submissions.map((submission) => submission.learner_id)),
  ];
  const learnerNames = new Map<string, string>();

  if (learnerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("auth_user_id, full_name")
      .eq("role", "learner")
      .in("auth_user_id", learnerIds);

    if (profilesError) throw profilesError;

    for (const profile of profiles ?? []) {
      learnerNames.set(profile.auth_user_id, profile.full_name);
    }
  }

  const submissionsByActivity = new Map<
    string,
    TeacherActivityReviewSubmission[]
  >();

  for (const submission of submissions) {
    const activitySubmissions =
      submissionsByActivity.get(submission.activity_id) ?? [];

    activitySubmissions.push({
      id: submission.id,
      learnerName:
        learnerNames.get(submission.learner_id) ??
        "Learner profile unavailable",
      status: submission.status,
      preliminaryMark: submission.preliminary_mark,
      preliminaryTotal: submission.preliminary_total,
      finalMark: submission.final_mark,
    });
    submissionsByActivity.set(submission.activity_id, activitySubmissions);
  }

  return activities
    .map((activity) => ({
      id: activity.id,
      title: activity.title,
      totalMarks: activity.activity_questions.reduce(
        (total, question) => total + question.marks,
        0,
      ),
      termNumber: activity.lesson_materials.lessons.term_number,
      weekNumber: activity.lesson_materials.lessons.week_number,
      createdAt: activity.created_at,
      submissions: submissionsByActivity.get(activity.id) ?? [],
    }))
    .sort((activityA, activityB) => {
      if (activityA.termNumber === null && activityB.termNumber !== null) return 1;
      if (activityB.termNumber === null && activityA.termNumber !== null) return -1;
      if (activityA.termNumber !== activityB.termNumber) {
        return (activityB.termNumber ?? 0) - (activityA.termNumber ?? 0);
      }
      if (activityA.weekNumber === null && activityB.weekNumber !== null) return 1;
      if (activityB.weekNumber === null && activityA.weekNumber !== null) return -1;
      if (activityA.weekNumber !== activityB.weekNumber) {
        return (activityB.weekNumber ?? 0) - (activityA.weekNumber ?? 0);
      }
      return (
        new Date(activityB.createdAt).getTime() -
        new Date(activityA.createdAt).getTime()
      );
    });
}
