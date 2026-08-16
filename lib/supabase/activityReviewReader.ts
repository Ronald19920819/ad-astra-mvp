import "server-only";

import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import { businessStudiesSubject } from "@/lib/subjects/subjectConfig";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";

const businessStudiesSubjectId =
  businessStudiesSubject.databaseId;

export type TeacherActivityReviewSubmission = {
  id: string;
  learnerName: string;
  status: string;
  submittedAt: string;
  preliminaryMark: number | null;
  preliminaryTotal: number | null;
  finalMark: number | null;
  originalTotalMarks: number;
};

export type TeacherActivityReviewMonitorStatus =
  | "submitted"
  | "marking_failed"
  | "awaiting_review"
  | "returned"
  | "not_submitted"
  | "overdue";

export type TeacherActivityReviewLearner = {
  learnerProfileId: string;
  learnerName: string;
  status: TeacherActivityReviewMonitorStatus;
  submission: TeacherActivityReviewSubmission | null;
};

export type TeacherActivityReview = {
  id: string;
  title: string;
  totalMarks: number;
  termNumber: number | null;
  weekNumber: number | null;
  createdAt: string;
  dueDate: string | null;
  learners: TeacherActivityReviewLearner[];
};

export type TeacherSubmissionReviewQuestion = {
  id: string;
  questionNumber: number;
  questionText: string;
  maximumMarks: number;
  assessmentObjective: string | null;
  answer: {
    id: string;
    answerText: string;
    kingdomMark: number | null;
    kingdomFeedback: string | null;
    teacherMark: number | null;
    teacherFeedback: string | null;
  };
};

export type TeacherSubmissionReview = {
  id: string;
  status: string;
  submittedAt: string;
  teacherComment: string | null;
  submittedActivityVersion: number | null;
  activity: {
    id: string;
    title: string;
    dueDate: string | null;
  };
  learnerName: string;
  reading: {
    title: string;
    contentText: string;
    sourceType: "pasted_text" | "pdf";
  };
  questions: TeacherSubmissionReviewQuestion[];
};

type ActivityReviewRow = {
  id: string;
  title: string;
  due_date: string | null;
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
  submitted_at: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  final_mark: number | null;
  original_total_marks: number | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

type LearnerProfileRow = {
  id: string;
  profile_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
  full_name: string;
};

export async function getSubjectActivityReviews(
  subjectId: string,
): Promise<
  TeacherActivityReview[]
> {
  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) throw new Error(authorization.error);
  const supabase = authorization.teacher.admin;
  const { data: activityData, error: activitiesError } = await supabase
    .from("activities")
    .select(`
      id,
      title,
      due_date,
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
    .eq("lesson_materials.lessons.subject_id", subjectId)
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
        submitted_at,
        preliminary_mark,
        preliminary_total,
        final_mark,
        original_total_marks,
        activity_snapshot
      `)
      .in("activity_id", activityIds)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    submissions = data ?? [];
  }

  let { data: enrolments, error: enrolmentsError } = await supabase
    .from("learner_subjects")
    .select("learner_profile_id")
    .eq("subject_id", subjectId)
    .eq("status", "approved")
    .eq("is_active", true);

  if (
    enrolmentsError?.code === "42703" ||
    enrolmentsError?.code === "PGRST204"
  ) {
    const fallback = await supabase
      .from("learner_subjects")
      .select("learner_profile_id")
      .eq("subject_id", subjectId);
    enrolments = fallback.data;
    enrolmentsError = fallback.error;
  }

  if (enrolmentsError) throw enrolmentsError;

  const currentLearnerProfileIds = [
    ...new Set((enrolments ?? []).map((enrolment) => enrolment.learner_profile_id)),
  ];

  let learnerProfiles: LearnerProfileRow[] = [];
  let profiles: ProfileRow[] = [];

  if (currentLearnerProfileIds.length > 0) {
    const { data: learnerData, error: learnerError } = await supabase
      .from("learner_profiles")
      .select("id, profile_id, status")
      .eq("status", "active")
      .in("id", currentLearnerProfileIds);

    if (learnerError) throw learnerError;
    learnerProfiles = (learnerData ?? []) as LearnerProfileRow[];
  }

  const profileIdsToLoad = learnerProfiles.map((profile) => profile.profile_id);

  if (profileIdsToLoad.length > 0) {
    const { data: profileData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, auth_user_id, full_name")
      .eq("role", "learner")
      .in("id", profileIdsToLoad);

    if (profilesError) throw profilesError;
    profiles = (profileData ?? []) as ProfileRow[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const currentLearners = learnerProfiles
    .flatMap((learnerProfile) => {
      const profile = profileById.get(learnerProfile.profile_id);
      return profile
        ? [
            {
              learnerProfileId: learnerProfile.id,
              learnerAuthUserId: profile.auth_user_id,
              learnerName: profile.full_name,
            },
          ]
        : [];
    })
    .sort((a, b) => a.learnerName.localeCompare(b.learnerName));

  const submissionByActivityLearner = new Map<string, TeacherActivityReviewSubmission>();

  for (const submission of submissions) {
    const key = `${submission.activity_id}:${submission.learner_id}`;
    if (submissionByActivityLearner.has(key)) continue;

    const learnerName =
      currentLearners.find((learner) => learner.learnerAuthUserId === submission.learner_id)
        ?.learnerName ?? "Learner profile unavailable";

    submissionByActivityLearner.set(key, {
      id: submission.id,
      learnerName,
      status: submission.status,
      submittedAt: submission.submitted_at,
      preliminaryMark: submission.preliminary_mark,
      preliminaryTotal: submission.preliminary_total,
      finalMark: submission.final_mark,
      originalTotalMarks:
        submission.original_total_marks ??
        (isActivitySubmissionSnapshot(submission.activity_snapshot)
          ? submission.activity_snapshot.activity.totalMarks
          : submission.preliminary_total ?? 0),
    });
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
      dueDate: activity.due_date,
      learners: currentLearners.map((learner) => {
        const submission =
          submissionByActivityLearner.get(`${activity.id}:${learner.learnerAuthUserId}`) ?? null;

        return {
          learnerProfileId: learner.learnerProfileId,
          learnerName: learner.learnerName,
          status: submission
            ? (submission.status as TeacherActivityReviewMonitorStatus)
            : isDateOverdue(activity.due_date)
              ? "overdue"
              : "not_submitted",
          submission,
        };
      }),
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

export async function getSubjectSubmissionReview(
  subjectId: string,
  submissionId: string,
): Promise<TeacherSubmissionReview | null> {
  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) throw new Error(authorization.error);
  const supabase = authorization.teacher.admin;
  const { data: submission, error: submissionError } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      learner_id,
      status,
      submitted_at,
      teacher_comment,
      activity_snapshot,
      submitted_activity_version,
      original_total_marks
    `)
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  if (!submission) return null;

  const snapshot = isActivitySubmissionSnapshot(
    submission.activity_snapshot,
  )
    ? submission.activity_snapshot
    : null;

  if (snapshot) {
    if (snapshot.subject.id !== subjectId) return null;

    const { data: answers, error: answersError } = await supabase
      .from("activity_submission_answers")
      .select(`
        id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        teacher_mark,
        teacher_feedback
      `)
      .eq("submission_id", submission.id);

    if (answersError) throw answersError;
    const answersByQuestionId = new Map(
      (answers ?? []).map((answer) => [answer.question_id, answer]),
    );
    const reviewQuestions: TeacherSubmissionReviewQuestion[] = [];

    for (const question of snapshot.questions) {
      const answer = answersByQuestionId.get(question.id);
      if (!answer) return null;

      reviewQuestions.push({
        id: question.id,
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        maximumMarks: question.marks,
        assessmentObjective: question.assessmentObjective,
        answer: {
          id: answer.id,
          answerText: answer.answer_text,
          kingdomMark: answer.kingdom_mark,
          kingdomFeedback: answer.kingdom_feedback,
          teacherMark: answer.teacher_mark,
          teacherFeedback: answer.teacher_feedback,
        },
      });
    }

    const { data: learnerProfile, error: learnerError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", submission.learner_id)
      .eq("role", "learner")
      .maybeSingle();

    if (learnerError) throw learnerError;

    return {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submitted_at,
      teacherComment: submission.teacher_comment,
      submittedActivityVersion: submission.submitted_activity_version,
      activity: {
        id: snapshot.activity.id,
        title: snapshot.activity.title,
        dueDate: snapshot.activity.dueDate,
      },
      learnerName:
        learnerProfile?.full_name ?? "Learner profile unavailable",
      reading: {
        title: snapshot.reading.title,
        contentText: snapshot.reading.contentText,
        sourceType: snapshot.reading.sourceType,
      },
      questions: reviewQuestions,
    };
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, title, due_date, lesson_material_id")
    .eq("id", submission.activity_id)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activity) return null;

  const { data: linkedMaterial, error: materialError } = await supabase
    .from("lesson_materials")
    .select(`
      id,
      lesson_id,
      material_type,
      title,
      content_text,
      source_type,
      lessons!inner (
        id,
        subject_id,
        status
      )
    `)
    .eq("id", activity.lesson_material_id)
    .maybeSingle();

  if (materialError) throw materialError;
  if (!linkedMaterial) return null;

  const lesson = linkedMaterial.lessons as unknown as {
    id: string;
    subject_id: string;
    status: string;
  };

  if (
    lesson.subject_id !== subjectId ||
    lesson.status !== "published"
  ) {
    return null;
  }

  let reading =
    linkedMaterial.material_type === "reading" &&
    linkedMaterial.content_text?.trim()
      ? {
          title: linkedMaterial.title,
          contentText: linkedMaterial.content_text,
          sourceType:
            linkedMaterial.source_type === "pdf"
              ? ("pdf" as const)
              : ("pasted_text" as const),
        }
      : null;

  if (!reading) {
    const { data: readingMaterial, error: readingError } = await supabase
      .from("lesson_materials")
      .select("title, content_text, source_type")
      .eq("lesson_id", linkedMaterial.lesson_id)
      .eq("material_type", "reading")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (readingError) throw readingError;
    if (readingMaterial?.content_text?.trim()) {
      reading = {
        title: readingMaterial.title,
        contentText: readingMaterial.content_text,
        sourceType:
          readingMaterial.source_type === "pdf"
            ? ("pdf" as const)
            : ("pasted_text" as const),
      };
    }
  }

  if (!reading) return null;

  const { data: questions, error: questionsError } = await supabase
    .from("activity_questions")
    .select(`
      id,
      question_number,
      question_text,
      marks,
      assessment_objective,
      display_order
    `)
    .eq("activity_id", activity.id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("question_number", { ascending: true });

  if (questionsError) throw questionsError;

  const { data: answers, error: answersError } = await supabase
    .from("activity_submission_answers")
    .select(`
      id,
      question_id,
      answer_text,
      kingdom_mark,
      kingdom_feedback,
      teacher_mark,
      teacher_feedback
    `)
    .eq("submission_id", submission.id);

  if (answersError) throw answersError;

  const answersByQuestionId = new Map(
    (answers ?? []).map((answer) => [answer.question_id, answer]),
  );
  const reviewQuestions: TeacherSubmissionReviewQuestion[] = [];

  for (const question of questions ?? []) {
    const answer = answersByQuestionId.get(question.id);
    if (!answer) return null;

    reviewQuestions.push({
      id: question.id,
      questionNumber: question.question_number,
      questionText: question.question_text,
      maximumMarks: question.marks,
      assessmentObjective: question.assessment_objective,
      answer: {
        id: answer.id,
        answerText: answer.answer_text,
        kingdomMark: answer.kingdom_mark,
        kingdomFeedback: answer.kingdom_feedback,
        teacherMark: answer.teacher_mark,
        teacherFeedback: answer.teacher_feedback,
      },
    });
  }

  const { data: learnerProfile, error: learnerError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("auth_user_id", submission.learner_id)
    .eq("role", "learner")
    .maybeSingle();

  if (learnerError) throw learnerError;

  return {
    id: submission.id,
    status: submission.status,
    submittedAt: submission.submitted_at,
    teacherComment: submission.teacher_comment,
    submittedActivityVersion: submission.submitted_activity_version,
    activity: {
      id: activity.id,
      title: activity.title,
      dueDate: activity.due_date,
    },
    learnerName: learnerProfile?.full_name ?? "Learner profile unavailable",
    reading,
    questions: reviewQuestions,
  };
}

export function getBusinessStudiesActivityReviews() {
  return getSubjectActivityReviews(businessStudiesSubjectId);
}

export function getBusinessStudiesSubmissionReview(submissionId: string) {
  return getSubjectSubmissionReview(
    businessStudiesSubjectId,
    submissionId,
  );
}
