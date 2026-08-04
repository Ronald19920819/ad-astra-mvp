import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ActivityDraftAnswerInput = {
  questionId: string;
  answerText: string;
};

export type LearnerActivityDraftRecord = {
  id: string;
  activityId: string;
  learnerId: string;
  subjectId: string;
  activityVersion: number;
  revision: number;
  updatedAt: string;
  answers: Array<{
    questionId: string;
    answerText: string;
  }>;
};

function logDraftSupabaseError(
  label: string,
  error: {
    message?: string | null;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  },
  context?: Record<string, unknown>,
) {
  console.error(label, {
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    ...context,
  });
}

type LearnerIdentityResult =
  | { learnerId: string }
  | { error: string; code: string; status: number };

type ActivityDraftContext =
  | {
      ok: true;
      activityId: string;
      subjectId: string;
      currentVersion: number;
      questionIds: string[];
      learnerId: string;
    }
  | {
      ok: false;
      error: string;
      code: string;
      status: number;
    };

async function getLearnerIdentity(): Promise<LearnerIdentityResult> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (user) return { learnerId: user.id };

  if (process.env.NODE_ENV !== "development") {
    return {
      error: "Learner sign-in required",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  const testLearnerId = process.env.TEST_LEARNER_ID?.trim();

  if (!testLearnerId) {
    return {
      error: "Development test learner is not configured.",
      code: "TEST_LEARNER_NOT_CONFIGURED",
      status: 500,
    };
  }

  if (!uuidPattern.test(testLearnerId)) {
    return {
      error: "The configured development test learner is invalid.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: authUserData, error: authUserError } =
    await supabase.auth.admin.getUserById(testLearnerId);

  if (authUserError || !authUserData.user) {
    return {
      error: "The configured development test learner does not exist.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", testLearnerId)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return {
      error: "The configured development test learner has no learner profile.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) {
    return {
      error:
        "The configured development test learner has no active learner profile.",
      code: "INVALID_TEST_LEARNER",
      status: 500,
    };
  }

  return { learnerId: testLearnerId };
}

export async function getAuthenticatedLearnerDraftIdentity() {
  return getLearnerIdentity();
}

export async function resolveLearnerActivityDraftContext(
  activityId: string,
): Promise<ActivityDraftContext> {
  if (!activityId || !uuidPattern.test(activityId)) {
    return {
      ok: false,
      error: "Invalid activity ID",
      code: "INVALID_ACTIVITY",
      status: 400,
    };
  }

  const identity = await getLearnerIdentity();
  if (!("learnerId" in identity)) {
    return {
      ok: false,
      error: identity.error,
      code: identity.code,
      status: identity.status,
    };
  }

  const { learnerId } = identity;
  const supabase = createSupabaseAdminClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(`
      id,
      version,
      lesson_material_id,
      lesson_materials!inner (
        id,
        lesson_id,
        lessons!inner (
          id,
          subject_id,
          status
        )
      )
    `)
    .eq("id", activityId)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activity) {
    return {
      ok: false,
      error: "Activity not found",
      code: "NOT_FOUND",
      status: 404,
    };
  }

  const activityWithRelations = activity as {
    version: number;
    lesson_materials:
      | {
          lessons:
            | {
                subject_id: string;
                status: string;
              }
            | Array<{
                subject_id: string;
                status: string;
              }>;
        }
      | Array<{
          lessons:
            | {
                subject_id: string;
                status: string;
              }
            | Array<{
                subject_id: string;
                status: string;
              }>;
        }>;
  };

  const lesson = Array.isArray(activityWithRelations.lesson_materials)
    ? activityWithRelations.lesson_materials[0]?.lessons
    : activityWithRelations.lesson_materials?.lessons;
  const lessonRow = Array.isArray(lesson) ? lesson[0] : lesson;
  const subjectId = lessonRow?.subject_id;
  const lessonStatus = lessonRow?.status;

  if (!subjectId || lessonStatus !== "published") {
    return {
      ok: false,
      error: "Activity not found",
      code: "NOT_FOUND",
      status: 404,
    };
  }

  const subjectAccess = await verifyLearnerSubjectAccess(learnerId, subjectId);
  if (!subjectAccess.allowed) {
    return {
      ok: false,
      error: "Learner access to this subject is required",
      code: "SUBJECT_ACCESS_REQUIRED",
      status: 403,
    };
  }

  const { data: existingSubmission, error: submissionError } = await supabase
    .from("activity_submissions")
    .select("id")
    .eq("learner_id", learnerId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  if (existingSubmission) {
    return {
      ok: false,
      error: "This activity has already been submitted",
      code: "ALREADY_SUBMITTED",
      status: 409,
    };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("activity_questions")
    .select("id")
    .eq("activity_id", activityId);

  if (questionsError) throw questionsError;

  return {
    ok: true,
    activityId,
    subjectId,
    currentVersion: activityWithRelations.version,
    questionIds: (questions ?? []).map((question) => question.id),
    learnerId,
  };
}

export async function loadLearnerActivityDraft(activityId: string) {
  const context = await resolveLearnerActivityDraftContext(activityId);
  if (!context.ok) return context;

  const supabase = createSupabaseAdminClient();
  const { data: draft, error: draftError } = await supabase
    .from("learner_activity_drafts")
    .select(`
      id,
      activity_id,
      learner_id,
      subject_id,
      activity_version,
      revision,
      updated_at,
      learner_activity_draft_answers (
        question_id,
        answer_text
      )
    `)
    .eq("learner_id", context.learnerId)
    .eq("activity_id", context.activityId)
    .maybeSingle();

  if (draftError) {
    logDraftSupabaseError("Unable to load learner activity draft row:", draftError, {
      activityId: context.activityId,
      learnerId: context.learnerId,
      status: 500,
    });
    throw draftError;
  }

  return {
    ok: true as const,
    learnerId: context.learnerId,
    subjectId: context.subjectId,
    currentActivityVersion: context.currentVersion,
    draft: draft
      ? ({
          id: draft.id,
          activityId: draft.activity_id,
          learnerId: draft.learner_id,
          subjectId: draft.subject_id,
          activityVersion: draft.activity_version,
          revision: draft.revision,
          updatedAt: draft.updated_at,
          answers: (draft.learner_activity_draft_answers ?? []).map((answer) => ({
            questionId: answer.question_id,
            answerText: answer.answer_text,
          })),
        } satisfies LearnerActivityDraftRecord)
      : null,
  };
}

export async function saveLearnerActivityDraft(input: {
  activityId: string;
  activityVersion: number;
  expectedRevision: number;
  answers: ActivityDraftAnswerInput[];
}) {
  const context = await resolveLearnerActivityDraftContext(input.activityId);
  if (!context.ok) return context;

  if (
    !Number.isInteger(input.activityVersion) ||
    input.activityVersion <= 0 ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    return {
      ok: false as const,
      error: "Invalid draft data",
      code: "INVALID_DRAFT",
      status: 400,
    };
  }

  if (input.activityVersion !== context.currentVersion) {
    return {
      ok: false as const,
      error:
        "This activity was updated by your teacher after you opened it. Reload the activity and review the latest questions before continuing.",
      code: "ACTIVITY_UPDATED_RELOAD_REQUIRED",
      status: 409,
    };
  }

  const officialQuestionIds = new Set(context.questionIds);
  if (
    input.answers.some(
      (answer) =>
        !uuidPattern.test(answer.questionId) ||
        !officialQuestionIds.has(answer.questionId) ||
        typeof answer.answerText !== "string",
    ) ||
    new Set(input.answers.map((answer) => answer.questionId)).size !==
      input.answers.length
  ) {
    return {
      ok: false as const,
      error: "Invalid draft data",
      code: "INVALID_DRAFT",
      status: 400,
    };
  }

  const answersToPersist = input.answers
    .map((answer) => ({
      question_id: answer.questionId,
      answer_text: answer.answerText,
    }))
    .filter((answer) => answer.answer_text.trim().length > 0);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("save_learner_activity_draft", {
    p_activity_id: context.activityId,
    p_learner_id: context.learnerId,
    p_subject_id: context.subjectId,
    p_activity_version: input.activityVersion,
    p_expected_revision: input.expectedRevision,
    p_answers: answersToPersist,
  });

  if (error) {
    if (
      error.code === "P0001" &&
      error.message.includes("DRAFT_REVISION_CONFLICT")
    ) {
      return {
        ok: false as const,
        error: "A newer draft was found. Reload the activity to continue safely.",
        code: "DRAFT_REVISION_CONFLICT",
        status: 409,
      };
    }

    if (
      error.code === "22023" &&
      error.message.includes("INVALID_DRAFT_")
    ) {
      return {
        ok: false as const,
        error: "Invalid draft data",
        code: "INVALID_DRAFT",
        status: 400,
      };
    }

    logDraftSupabaseError("Learner activity draft RPC failed:", error, {
      rpcName: "save_learner_activity_draft",
      activityId: context.activityId,
      learnerId: context.learnerId,
      subjectId: context.subjectId,
      activityVersion: input.activityVersion,
      expectedRevision: input.expectedRevision,
      answerCount: answersToPersist.length,
      status: 500,
    });
    throw error;
  }

  const savedDraft = Array.isArray(data) ? (data[0] ?? null) : data;
  const savedDraftId =
    savedDraft &&
    typeof savedDraft === "object" &&
    "draft_id" in savedDraft &&
    typeof savedDraft.draft_id === "string"
      ? savedDraft.draft_id
      : null;
  const savedRevision =
    savedDraft &&
    typeof savedDraft === "object" &&
    "revision" in savedDraft &&
    Number.isInteger(savedDraft.revision)
      ? savedDraft.revision
      : null;
  const savedUpdatedAt =
    savedDraft &&
    typeof savedDraft === "object" &&
    "updated_at" in savedDraft &&
    typeof savedDraft.updated_at === "string"
      ? savedDraft.updated_at
      : null;

  if (!savedDraftId || savedRevision === null) {
    console.error("Learner activity draft RPC returned an unexpected shape:", {
      rpcName: "save_learner_activity_draft",
      activityId: context.activityId,
      learnerId: context.learnerId,
      subjectId: context.subjectId,
      activityVersion: input.activityVersion,
      expectedRevision: input.expectedRevision,
      answerCount: answersToPersist.length,
      data,
    });
  }

  const { data: draft, error: draftError } = await supabase
    .from("learner_activity_drafts")
    .select(`
      id,
      activity_id,
      learner_id,
      subject_id,
      activity_version,
      revision,
      updated_at,
      learner_activity_draft_answers (
        question_id,
        answer_text
      )
    `)
    .eq(savedDraftId ? "id" : "activity_id", savedDraftId ?? context.activityId)
    .eq("learner_id", context.learnerId)
    .maybeSingle();

  if (draftError) {
    logDraftSupabaseError(
      "Unable to reload learner activity draft after RPC save:",
      draftError,
      {
        rpcName: "save_learner_activity_draft",
        activityId: context.activityId,
        learnerId: context.learnerId,
        subjectId: context.subjectId,
        activityVersion: input.activityVersion,
        expectedRevision: input.expectedRevision,
        savedDraftId,
        savedRevision,
        status: 500,
      },
    );

    if (savedRevision !== null) {
      return {
        ok: true as const,
        learnerId: context.learnerId,
        draft: {
          id: savedDraftId ?? `draft:${context.learnerId}:${context.activityId}`,
          activityId: context.activityId,
          learnerId: context.learnerId,
          subjectId: context.subjectId,
          activityVersion: input.activityVersion,
          revision: savedRevision,
          updatedAt: savedUpdatedAt ?? new Date().toISOString(),
          answers: input.answers,
        } satisfies LearnerActivityDraftRecord,
      };
    }

    throw draftError;
  }

  if (!draft) {
    console.error("The saved learner activity draft could not be reloaded.", {
      rpcName: "save_learner_activity_draft",
      activityId: context.activityId,
      learnerId: context.learnerId,
      subjectId: context.subjectId,
      activityVersion: input.activityVersion,
      expectedRevision: input.expectedRevision,
      savedDraftId,
      savedRevision,
      status: 500,
    });

    if (savedRevision !== null) {
      return {
        ok: true as const,
        learnerId: context.learnerId,
        draft: {
          id: savedDraftId ?? `draft:${context.learnerId}:${context.activityId}`,
          activityId: context.activityId,
          learnerId: context.learnerId,
          subjectId: context.subjectId,
          activityVersion: input.activityVersion,
          revision: savedRevision,
          updatedAt: savedUpdatedAt ?? new Date().toISOString(),
          answers: input.answers,
        } satisfies LearnerActivityDraftRecord,
      };
    }

    throw new Error("The saved draft could not be reloaded.");
  }

  return {
    ok: true as const,
    learnerId: context.learnerId,
    draft: {
      id: draft.id,
      activityId: draft.activity_id,
      learnerId: draft.learner_id,
      subjectId: draft.subject_id,
      activityVersion: draft.activity_version,
      revision: draft.revision,
      updatedAt: draft.updated_at,
      answers: (draft.learner_activity_draft_answers ?? []).map((answer) => ({
        questionId: answer.question_id,
        answerText: answer.answer_text,
      })),
    } satisfies LearnerActivityDraftRecord,
  };
}

export async function deleteLearnerActivityDraft(
  activityId: string,
  learnerId: string,
) {
  if (!uuidPattern.test(activityId) || !uuidPattern.test(learnerId)) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("learner_activity_drafts")
    .delete()
    .eq("activity_id", activityId)
    .eq("learner_id", learnerId);

  if (error) throw error;
}
