import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  getAuthenticatedLearnerProfile,
  getLearnerProfileByAuthUserId,
} from "@/lib/supabase/learnerProfile";
import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingSnapshotColumnError(
  error: { code?: string; message?: string } | null,
) {
  return (
    error?.code === "42703" &&
    (error.message?.includes("original_total_marks") ||
      error.message?.includes("activity_snapshot") ||
      error.message?.includes("submitted_activity_version"))
  );
}

export type LearnerIdentityResult =
  | {
      status: "success";
      learnerId: string;
      fullName: string | null;
      isDevelopmentFallback: boolean;
    }
  | {
      status: "error";
      message: string;
      code: string;
    };

export type LearnerWorkStatus =
  | "submitted"
  | "marking_failed"
  | "awaiting_review"
  | "returned";

export type LearnerWorkSummary = {
  id: string;
  status: LearnerWorkStatus;
  submittedAt: string;
  reviewedAt: string | null;
  preliminaryMark: number | null;
  preliminaryTotal: number | null;
  preliminaryPercentage: number | null;
  finalMark: number | null;
  activity: {
    id: string;
    title: string;
    totalMarks: number;
  };
  subject: {
    id: string;
    name: string;
  };
  lesson: {
    id: string;
    title: string;
    termNumber: number | null;
    weekNumber: number | null;
  };
};

export type LearnerWorkQuestion = {
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
    kingdomJudgement: string | null;
    teacherMark: number | null;
    teacherFeedback: string | null;
  };
};

export type LearnerWorkDetail = LearnerWorkSummary & {
  teacherComment: string | null;
  reading: {
    title: string;
    sourceType: "pasted_text" | "pdf";
    contentText: string;
  };
  questions: LearnerWorkQuestion[];
};

export async function getCurrentLearnerIdentity(
  profile?: AuthenticatedLearnerProfile | null,
): Promise<LearnerIdentityResult> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (user) {
    const authenticatedProfile =
      profile && profile.userId === user.id
        ? profile
        : await getAuthenticatedLearnerProfile();
    if (!authenticatedProfile) {
      return {
        status: "error",
        message: "A valid learner account is required.",
        code: "LEARNER_ACCESS_REQUIRED",
      };
    }

    return {
      status: "success",
      learnerId: authenticatedProfile.userId,
      fullName: authenticatedProfile.displayName,
      isDevelopmentFallback: false,
    };
  }

  if (process.env.NODE_ENV !== "development") {
    return {
      status: "error",
      message: "Learner sign-in required.",
      code: "UNAUTHORIZED",
    };
  }

  const testLearnerId = process.env.TEST_LEARNER_ID?.trim();

  if (!testLearnerId) {
    return {
      status: "error",
      message: "Development test learner is not configured.",
      code: "TEST_LEARNER_NOT_CONFIGURED",
    };
  }

  if (!uuidPattern.test(testLearnerId)) {
    return {
      status: "error",
      message: "The configured development test learner is invalid.",
      code: "INVALID_TEST_LEARNER",
    };
  }

  const learnerProfile = await getLearnerProfileByAuthUserId(testLearnerId);
  if (!learnerProfile) {
    return {
      status: "error",
      message: "The configured development test learner is invalid.",
      code: "INVALID_TEST_LEARNER",
    };
  }

  return {
    status: "success",
    learnerId: testLearnerId,
    fullName: learnerProfile.displayName,
    isDevelopmentFallback: true,
  };
}

type SubmissionRow = {
  id: string;
  activity_id: string;
  status: LearnerWorkStatus;
  submitted_at: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  preliminary_percentage: number | null;
  final_mark: number | null;
  reviewed_at: string | null;
  teacher_comment?: string | null;
  activity_snapshot: ActivitySubmissionSnapshot | null;
  submitted_activity_version: number | null;
  original_total_marks: number | null;
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
  material_type: string;
  title: string;
  content_text: string | null;
};

type LessonRow = {
  id: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  subject_id: string;
};

function createSummary(
  submission: SubmissionRow,
  activity: ActivityRow,
  lesson: LessonRow,
): LearnerWorkSummary {
  if (isActivitySubmissionSnapshot(submission.activity_snapshot)) {
    const snapshot = submission.activity_snapshot;

    return {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submitted_at,
      reviewedAt: submission.reviewed_at,
      preliminaryMark: submission.preliminary_mark,
      preliminaryTotal: submission.preliminary_total,
      preliminaryPercentage: submission.preliminary_percentage,
      finalMark: submission.final_mark,
      activity: {
        id: snapshot.activity.id,
        title: snapshot.activity.title,
        totalMarks:
          submission.original_total_marks ?? snapshot.activity.totalMarks,
      },
      subject: {
        id: snapshot.subject.id,
        name: snapshot.subject.name,
      },
      lesson: {
        id: snapshot.lesson.id,
        title: snapshot.lesson.title,
        termNumber: snapshot.lesson.termNumber,
        weekNumber: snapshot.lesson.weekNumber,
      },
    };
  }

  const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);

  return {
    id: submission.id,
    status: submission.status,
    submittedAt: submission.submitted_at,
    reviewedAt: submission.reviewed_at,
    preliminaryMark: submission.preliminary_mark,
    preliminaryTotal: submission.preliminary_total,
    preliminaryPercentage: submission.preliminary_percentage,
    finalMark: submission.final_mark,
    activity: {
      id: activity.id,
      title: activity.title,
      totalMarks: activity.total_marks,
    },
    subject: {
      id: lesson.subject_id,
      name: subject?.displayName ?? "Subject",
    },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      termNumber: lesson.term_number,
      weekNumber: lesson.week_number,
    },
  };
}

export async function getLearnerWorkOverview(
  learnerId: string,
): Promise<LearnerWorkSummary[]> {
  const supabase = createSupabaseAdminClient();
  let { data: submissionData, error: submissionError } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      status,
      submitted_at,
      preliminary_mark,
      preliminary_total,
      preliminary_percentage,
      final_mark,
      reviewed_at,
      activity_snapshot,
      submitted_activity_version,
      original_total_marks
    `)
    .eq("learner_id", learnerId)
    .order("submitted_at", { ascending: false });

  if (isMissingSnapshotColumnError(submissionError)) {
    const legacyResult = await supabase
      .from("activity_submissions")
      .select(`
        id,
        activity_id,
        status,
        submitted_at,
        preliminary_mark,
        preliminary_total,
        preliminary_percentage,
        final_mark,
        reviewed_at
      `)
      .eq("learner_id", learnerId)
      .order("submitted_at", { ascending: false });
    submissionData = (legacyResult.data ?? []).map((submission) => ({
      ...submission,
      activity_snapshot: null,
      submitted_activity_version: null,
      original_total_marks: null,
    })) as typeof submissionData;
    submissionError = legacyResult.error;
  }

  if (submissionError) throw submissionError;
  const submissions = (submissionData ?? []) as SubmissionRow[];
  if (submissions.length === 0) return [];

  const activityIds = [...new Set(submissions.map((item) => item.activity_id))];
  const { data: activityData, error: activityError } = await supabase
    .from("activities")
    .select("id, title, total_marks, lesson_material_id")
    .in("id", activityIds);

  if (activityError) throw activityError;
  const activities = (activityData ?? []) as ActivityRow[];
  const activityById = new Map(activities.map((item) => [item.id, item]));
  const materialIds = [
    ...new Set(activities.map((item) => item.lesson_material_id)),
  ];
  if (materialIds.length === 0) return [];

  const { data: materialData, error: materialError } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id, material_type, title, content_text")
    .in("id", materialIds);

  if (materialError) throw materialError;
  const materials = (materialData ?? []) as MaterialRow[];
  const materialById = new Map(materials.map((item) => [item.id, item]));
  const lessonIds = [...new Set(materials.map((item) => item.lesson_id))];
  if (lessonIds.length === 0) return [];

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, term_number, week_number, subject_id")
    .in("id", lessonIds);

  if (lessonError) throw lessonError;
  const lessons = (lessonData ?? []) as LessonRow[];
  const lessonById = new Map(lessons.map((item) => [item.id, item]));

  return submissions.flatMap((submission) => {
    const activity = activityById.get(submission.activity_id);
    if (!activity) return [];

    const material = materialById.get(activity.lesson_material_id);
    if (!material) return [];

    const lesson = lessonById.get(material.lesson_id);
    if (!lesson) return [];

    return [createSummary(submission, activity, lesson)];
  });
}

export async function getLearnerWorkDetail(
  learnerId: string,
  submissionId: string,
): Promise<LearnerWorkDetail | null> {
  if (!uuidPattern.test(submissionId)) return null;

  const supabase = createSupabaseAdminClient();
  const { data: submissionData, error: submissionError } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      status,
      submitted_at,
      preliminary_mark,
      preliminary_total,
      preliminary_percentage,
      final_mark,
      reviewed_at,
      teacher_comment,
      activity_snapshot,
      submitted_activity_version,
      original_total_marks
    `)
    .eq("id", submissionId)
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  if (!submissionData) return null;
  const submission = submissionData as SubmissionRow;
  const snapshot = isActivitySubmissionSnapshot(submission.activity_snapshot)
    ? submission.activity_snapshot
    : null;

  if (snapshot) {
    const { data: answerData, error: answerError } = await supabase
      .from("activity_submission_answers")
      .select(`
        id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        kingdom_judgement,
        teacher_mark,
        teacher_feedback
      `)
      .eq("submission_id", submission.id);

    if (answerError) throw answerError;
    const answerByQuestionId = new Map(
      (answerData ?? []).map((answer) => [answer.question_id, answer]),
    );
    const questions: LearnerWorkQuestion[] = [];

    for (const question of snapshot.questions) {
      const answer = answerByQuestionId.get(question.id);
      if (!answer) return null;

      questions.push({
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
          kingdomJudgement: answer.kingdom_judgement,
          teacherMark: answer.teacher_mark,
          teacherFeedback: answer.teacher_feedback,
        },
      });
    }

    const snapshotActivity: ActivityRow = {
      id: snapshot.activity.id,
      title: snapshot.activity.title,
      total_marks:
        submission.original_total_marks ?? snapshot.activity.totalMarks,
      lesson_material_id: snapshot.reading.id,
    };
    const snapshotLesson: LessonRow = {
      id: snapshot.lesson.id,
      title: snapshot.lesson.title,
      term_number: snapshot.lesson.termNumber,
      week_number: snapshot.lesson.weekNumber,
      subject_id: snapshot.subject.id,
    };

    return {
      ...createSummary(submission, snapshotActivity, snapshotLesson),
      teacherComment: submission.teacher_comment ?? null,
      reading: {
        title: snapshot.reading.title,
        sourceType: snapshot.reading.sourceType,
        contentText: snapshot.reading.contentText,
      },
      questions,
    };
  }

  const { data: activityData, error: activityError } = await supabase
    .from("activities")
    .select("id, title, total_marks, lesson_material_id")
    .eq("id", submission.activity_id)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activityData) return null;
  const activity = activityData as ActivityRow;

  const { data: materialData, error: materialError } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id, material_type, title, content_text")
    .eq("id", activity.lesson_material_id)
    .maybeSingle();

  if (materialError) throw materialError;
  if (!materialData) return null;
  const material = materialData as MaterialRow;

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, term_number, week_number, subject_id")
    .eq("id", material.lesson_id)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (!lessonData) return null;
  const lesson = lessonData as LessonRow;

  let reading =
    material.material_type === "reading" && material.content_text?.trim()
      ? {
          title: material.title,
          sourceType: "pasted_text" as const,
          contentText: material.content_text,
        }
      : null;

  if (!reading) {
    const { data: readingData, error: readingError } = await supabase
      .from("lesson_materials")
      .select("title, content_text")
      .eq("lesson_id", lesson.id)
      .eq("material_type", "reading")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (readingError) throw readingError;
    if (readingData?.content_text?.trim()) {
      reading = {
        title: readingData.title,
        sourceType: "pasted_text" as const,
        contentText: readingData.content_text,
      };
    }
  }

  if (!reading) return null;

  const { data: questionData, error: questionError } = await supabase
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

  if (questionError) throw questionError;

  const { data: answerData, error: answerError } = await supabase
    .from("activity_submission_answers")
    .select(`
      id,
      question_id,
      answer_text,
      kingdom_mark,
      kingdom_feedback,
      kingdom_judgement,
      teacher_mark,
      teacher_feedback
    `)
    .eq("submission_id", submission.id);

  if (answerError) throw answerError;
  const answerByQuestionId = new Map(
    (answerData ?? []).map((answer) => [answer.question_id, answer]),
  );
  const questions: LearnerWorkQuestion[] = [];

  for (const question of questionData ?? []) {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) return null;

    questions.push({
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
        kingdomJudgement: answer.kingdom_judgement,
        teacherMark: answer.teacher_mark,
        teacherFeedback: answer.teacher_feedback,
      },
    });
  }

  return {
    ...createSummary(submission, activity, lesson),
    teacherComment: submission.teacher_comment ?? null,
    reading,
    questions,
  };
}
