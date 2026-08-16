import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  markBusinessStudiesActivity,
  type ActivityMarkingQuestion,
} from "@/lib/kingdom/examiner/businessStudiesActivity";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/supabase/server";
import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import { readingContentToPlainText } from "@/lib/readings/structuredReading";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { verifyLearnerSubjectAccess } from "@/lib/supabase/subjectAccess";
import { deleteLearnerActivityDraft } from "@/lib/supabase/activityDrafts";
import { createActivitySubmissionSnapshot } from "@/lib/activities/activitySnapshot";
import {
  buildActivitySubmissionPdfSnapshotPath,
  LESSON_READING_PDF_BUCKET,
} from "@/lib/activities/activitySnapshotPdf";
import { buildOpenAIStoredPdfInput } from "@/lib/kingdom/lessonReadingGeneration";
import type { OpenAIReadingInput } from "@/lib/kingdom/lessonReadingGeneration";
import { hasPdfSignature, isLessonReadingPdfPath } from "@/lib/lessons/pdfReading";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmittedAnswer = {
  questionId: string;
  answerText: string;
};

type OfficialActivityQuestion = {
  id: string;
  question_number: number;
  display_order: number | null;
  paper: string | null;
  question_text: string;
  marks: number;
  assessment_objective: string | null;
  guidance: string | null;
  question_type: string | null;
  answer_text: string | null;
};

function isSubmittedAnswer(value: unknown): value is SubmittedAnswer {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.questionId === "string" &&
    uuidPattern.test(answer.questionId) &&
    typeof answer.answerText === "string" &&
    answer.answerText.length <= 10000
  );
}

type LearnerIdentityResult =
  | { learnerId: string }
  | { error: string; code: string; status: number };

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

async function loadSavedSubmission(
  learnerId: string,
  activityId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(`
      id,
      activity_id,
      status,
      submitted_at,
      preliminary_mark,
      preliminary_total,
      preliminary_percentage,
      kingdom_marked_at,
      final_mark,
      reviewed_at,
      activity_snapshot,
      submitted_activity_version,
      original_total_marks,
      snapshot_created_at,
      activity_submission_answers (
        id,
        question_id,
        answer_text,
        kingdom_mark,
        kingdom_feedback,
        kingdom_judgement,
        teacher_mark,
        teacher_feedback
      )
    `)
    .eq("learner_id", learnerId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markSubmissionAsFailed(submissionId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("activity_submissions")
    .update({
      status: "marking_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    console.error("Unable to record activity marking failure:", {
      submissionId,
      message: error.message,
      code: error.code,
    });
  }
}

export async function GET(request: Request) {
  const identity = await getLearnerIdentity();

  if (!("learnerId" in identity)) {
    return NextResponse.json(
      { error: identity.error, code: identity.code },
      { status: identity.status },
    );
  }

  const { learnerId } = identity;

  const activityId = new URL(request.url).searchParams.get("activityId");

  if (!activityId || !uuidPattern.test(activityId)) {
    return NextResponse.json(
      { error: "Invalid activity ID", code: "INVALID_SUBMISSION" },
      { status: 400 },
    );
  }

  try {
    const submission = await loadSavedSubmission(learnerId, activityId);
    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Unable to load learner activity submission:", {
      activityId,
      learnerId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to load this submission", code: "LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let submissionId: string | null = null;
  let learnerId: string | null = null;
  let activityIdForLog: string | null = null;
  let snapshotPdfPath: string | null = null;
  let snapshotPersisted = false;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const activityId = body.activityId;
    const expectedActivityVersion = body.activityVersion;
    const submittedAnswers = body.answers;
    activityIdForLog = typeof activityId === "string" ? activityId : null;

    if (
      typeof activityId !== "string" ||
      !uuidPattern.test(activityId) ||
      !Number.isInteger(expectedActivityVersion) ||
      Number(expectedActivityVersion) <= 0 ||
      !Array.isArray(submittedAnswers) ||
      submittedAnswers.length === 0 ||
      submittedAnswers.length > 100 ||
      !submittedAnswers.every(isSubmittedAnswer)
    ) {
      return NextResponse.json(
        { error: "Invalid submission data", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    const questionIds = submittedAnswers.map((answer) => answer.questionId);

    if (new Set(questionIds).size !== questionIds.length) {
      return NextResponse.json(
        { error: "Duplicate question IDs are not allowed", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    if (submittedAnswers.some((answer) => !answer.answerText.trim())) {
      return NextResponse.json(
        { error: "Please answer every question before submitting", code: "BLANK_ANSWERS" },
        { status: 422 },
      );
    }

    const identity = await getLearnerIdentity();

    if (!("learnerId" in identity)) {
      return NextResponse.json(
        { error: identity.error, code: identity.code },
        { status: identity.status },
      );
    }

    learnerId = identity.learnerId;

    const supabase = createSupabaseAdminClient();
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select(`
        id,
        title,
        instructions,
        total_marks,
        due_date,
        lesson_material_id,
        version
      `)
      .eq("id", activityId)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    if (activity.version !== expectedActivityVersion) {
      return NextResponse.json(
        {
          error:
            "This activity was updated by your teacher after you opened it. Reload the activity and review the latest questions before submitting.",
          code: "ACTIVITY_UPDATED_RELOAD_REQUIRED",
        },
        { status: 409 },
      );
    }

    const { data: material, error: materialError } = await supabase
      .from("lesson_materials")
      .select("id, title, lesson_id, material_type, source_type, content_text, content_url")
      .eq("id", activity.lesson_material_id)
      .maybeSingle();

    if (materialError) throw materialError;
    if (
      !material ||
      material.material_type !== "reading" ||
      (material.source_type !== "pdf" && !material.content_text?.trim())
    ) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select(`
        id,
        title,
        lesson_number,
        term_number,
        week_number,
        subject_id,
        status
      `)
      .eq("id", material.lesson_id)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (
      !lesson ||
      lesson.status !== "published"
    ) {
      return NextResponse.json(
        { error: "Activity not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    const subject = getSubjectConfigurationByDatabaseId(lesson.subject_id);
    if (!subject) {
      return NextResponse.json(
        { error: "Activity subject is not supported", code: "INVALID_SUBJECT" },
        { status: 422 },
      );
    }
    const subjectAccess = await verifyLearnerSubjectAccess(
      learnerId,
      lesson.subject_id,
    );
    if (!subjectAccess.allowed) {
      return NextResponse.json(
        {
          error: "Learner access to this subject is required",
          code: "SUBJECT_ACCESS_REQUIRED",
        },
        { status: 403 },
      );
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from("activity_questions")
      .select(`
        id,
        question_text,
        marks,
        assessment_objective,
        guidance,
        paper,
        question_type,
        answer_text,
        display_order,
        question_number
      `)
      .eq("activity_id", activityId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("question_number", { ascending: true });

    if (questionsError) throw questionsError;

    const officialQuestions = (questionsData ?? []) as OfficialActivityQuestion[];
    const officialQuestionIds = new Set(
      officialQuestions.map((question) => question.id),
    );

    if (officialQuestions.length === 0) {
      return NextResponse.json(
        { error: "This activity has no questions", code: "NO_QUESTIONS" },
        { status: 422 },
      );
    }

    if (
      officialQuestions.some(
        (question) =>
          !Number.isInteger(question.marks) || question.marks <= 0,
      )
    ) {
      return NextResponse.json(
        {
          error: "This activity has invalid question marks",
          code: "INVALID_ACTIVITY",
        },
        { status: 422 },
      );
    }

    if (
      submittedAnswers.length !== officialQuestions.length ||
      submittedAnswers.some(
        (answer) => !officialQuestionIds.has(answer.questionId),
      )
    ) {
      return NextResponse.json(
        { error: "Invalid submission data", code: "INVALID_SUBMISSION" },
        { status: 400 },
      );
    }

    const { data: existingSubmission, error: existingError } = await supabase
      .from("activity_submissions")
      .select("id")
      .eq("learner_id", learnerId)
      .eq("activity_id", activityId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingSubmission) {
      return NextResponse.json(
        { error: "This activity has already been submitted", code: "ALREADY_SUBMITTED" },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    let readingInput: OpenAIReadingInput = { content: [], cleanup: async () => {} };
    let lessonReadingForMarking = readingContentToPlainText(material.content_text);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const snapshotReading =
      material.source_type === "pdf"
        ? await (async () => {
            if (
              typeof material.content_url !== "string" ||
              !isLessonReadingPdfPath(
                material.content_url,
                lesson.subject_id,
                lesson.id,
              )
            ) {
              throw new Error("The saved PDF reading could not be resolved securely.");
            }

            const { data: pdfBlob, error: downloadError } = await supabase.storage
              .from(LESSON_READING_PDF_BUCKET)
              .download(material.content_url);

            if (downloadError || !pdfBlob) {
              throw new Error(
                "The saved PDF reading could not be downloaded from secure storage.",
              );
            }

            const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
            if (!hasPdfSignature(bytes)) {
              throw new Error("The saved PDF reading is missing or invalid.");
            }

            snapshotPdfPath = buildActivitySubmissionPdfSnapshotPath(
              learnerId,
              activity.id,
            );

            const { error: uploadError } = await supabase.storage
              .from(LESSON_READING_PDF_BUCKET)
              .upload(snapshotPdfPath, bytes, {
                contentType: "application/pdf",
                upsert: false,
              });

            if (uploadError) throw uploadError;

            readingInput = await buildOpenAIStoredPdfInput({
              admin: supabase,
              openai,
              storagePath: snapshotPdfPath,
              title: material.title,
              pdfDetail: "auto",
              introText:
                "Use the attached PDF as the authoritative saved learner submission reading evidence.",
            });
            lessonReadingForMarking =
              "Authoritative saved lesson reading is attached separately as a PDF file input.";

            return {
              id: material.id,
              title: material.title,
              sourceType: "pdf" as const,
              contentText: "",
              pdfStoragePath: snapshotPdfPath,
            };
          })()
        : {
            id: material.id,
            title: material.title,
            sourceType: "pasted_text" as const,
            contentText: material.content_text ?? "",
            pdfStoragePath: null,
          };

    const snapshot = createActivitySubmissionSnapshot({
      submittedAt: now,
      activity: {
        id: activity.id,
        version: activity.version,
        title: activity.title,
        instructions: activity.instructions,
        totalMarks: activity.total_marks,
        dueDate: activity.due_date,
      },
      subject: {
        id: lesson.subject_id,
        name: subject.displayName,
      },
      lesson: {
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lesson.lesson_number,
        termNumber: lesson.term_number,
        weekNumber: lesson.week_number,
      },
      reading: snapshotReading,
      questions: officialQuestions.map((question) => ({
        id: question.id,
        questionNumber: question.question_number,
        displayOrder:
          question.display_order ?? question.question_number,
        paper: question.paper,
        questionType: question.question_type,
        questionText: question.question_text,
        marks: question.marks,
        assessmentObjective: question.assessment_objective,
        guidance: question.guidance,
      })),
    });
    const { data: createdSubmissionId, error: submissionError } =
      await supabase.rpc("create_activity_submission_snapshot", {
        p_activity_id: activity.id,
        p_learner_id: learnerId,
        p_expected_version: activity.version,
        p_snapshot: snapshot,
        p_original_total_marks: activity.total_marks,
        p_answers: submittedAnswers.map((answer) => ({
          question_id: answer.questionId,
          answer_text: answer.answerText.trim(),
        })),
        p_submitted_at: now,
      });

    if (submissionError) {
      if (submissionError.code === "23505") {
        return NextResponse.json(
          { error: "This activity has already been submitted", code: "ALREADY_SUBMITTED" },
          { status: 409 },
        );
      }
      if (
        submissionError.code === "P0001" &&
        submissionError.message.includes("ACTIVITY_VERSION_CHANGED")
      ) {
        return NextResponse.json(
          {
            error:
              "This activity was updated by your teacher after you opened it. Reload the activity and review the latest questions before submitting.",
            code: "ACTIVITY_UPDATED_RELOAD_REQUIRED",
          },
          { status: 409 },
        );
      }
      throw submissionError;
    }

    if (
      typeof createdSubmissionId !== "string" ||
      !uuidPattern.test(createdSubmissionId)
    ) {
      throw new Error("The activity submission ID was not returned.");
    }
    submissionId = createdSubmissionId;
    snapshotPersisted = true;

    try {
      await deleteLearnerActivityDraft(activityId, learnerId);
    } catch (draftCleanupError) {
      console.error("Unable to remove learner activity draft after submission:", {
        activityId,
        learnerId,
        submissionId: createdSubmissionId,
        draftCleanupError,
      });
    }

    const { data: savedAnswers, error: answersError } = await supabase
      .from("activity_submission_answers")
      .select("id, submission_id, question_id, answer_text")
      .eq("submission_id", createdSubmissionId);

    if (answersError) {
      throw answersError;
    }

    const persistedAnswers = savedAnswers ?? [];
    const learnerAnswers = new Map(
      persistedAnswers.map((answer) => [
        answer.question_id,
        answer.answer_text,
      ]),
    );
    const markingQuestions: ActivityMarkingQuestion[] = officialQuestions.map(
      (question) => ({
        questionId: question.id,
        questionText: question.question_text,
        maximumMark: question.marks,
        assessmentObjective: question.assessment_objective,
        guidance: question.guidance,
        questionType: question.question_type,
        expectedAnswer: question.answer_text,
        learnerAnswer: learnerAnswers.get(question.id) ?? "",
      }),
    );

    let markingResult;

    try {
      const subjectContext = buildKingdomSubjectContext({
        subjectKey: subject.key,
        role: "Examiner",
        taskType: "Mark learner activity",
      });
      try {
        markingResult = await markBusinessStudiesActivity({
          subjectContext,
          activityTitle: activity.title,
          lessonTitle: lesson.title,
          lessonReading: lessonReadingForMarking,
          questions: markingQuestions,
          readingInput: readingInput.content,
        });
      } finally {
        await readingInput.cleanup();
      }
    } catch (error) {
      console.error("Kingdom activity preliminary marking failed:", {
        activityId,
        submissionId: createdSubmissionId,
        error,
      });
      await markSubmissionAsFailed(createdSubmissionId);
      const savedSubmission = await loadSavedSubmission(learnerId, activityId);

      return NextResponse.json(
        {
          error:
            "Your activity was saved, but preliminary marking could not be completed.",
          code: "MARKING_FAILED",
          saved: true,
          submission: savedSubmission,
        },
        { status: 502 },
      );
    }

    const resultByQuestionId = new Map(
      markingResult.results.map((result) => [result.questionId, result]),
    );
    const markedAnswerRows = persistedAnswers.map((answer) => {
      const result = resultByQuestionId.get(answer.question_id);

      if (!result) {
        throw new Error("A marked answer result is missing.");
      }

      return {
        id: answer.id,
        submission_id: answer.submission_id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        kingdom_mark: result.awardedMark,
        kingdom_feedback: result.feedback,
        kingdom_judgement: result.judgement,
        updated_at: new Date().toISOString(),
      };
    });
    const { error: markingSaveError } = await supabase
      .from("activity_submission_answers")
      .upsert(markedAnswerRows, { onConflict: "submission_id,question_id" });

    if (markingSaveError) throw markingSaveError;

    const markedAt = new Date().toISOString();
    const { error: submissionUpdateError } = await supabase
      .from("activity_submissions")
      .update({
        status: "awaiting_review",
        preliminary_mark: markingResult.preliminaryMark,
        preliminary_total: markingResult.totalMarks,
        preliminary_percentage: markingResult.percentage,
        kingdom_marked_at: markedAt,
        updated_at: markedAt,
      })
      .eq("id", createdSubmissionId);

    if (submissionUpdateError) throw submissionUpdateError;

    const savedSubmission = await loadSavedSubmission(learnerId, activityId);
    return NextResponse.json({ submission: savedSubmission });
  } catch (error) {
    if (submissionId) await markSubmissionAsFailed(submissionId);

    if (!snapshotPersisted && snapshotPdfPath) {
      const cleanupClient = createSupabaseAdminClient();
      const { error: cleanupError } = await cleanupClient.storage
        .from(LESSON_READING_PDF_BUCKET)
        .remove([snapshotPdfPath]);
      if (cleanupError) {
        console.warn("Uncommitted activity snapshot PDF cleanup failed:", {
          snapshotPdfPath,
          message: cleanupError.message,
        });
      }
    }

    console.error("Unable to submit and mark learner activity:", {
      activityId: activityIdForLog,
      learnerId,
      submissionId,
      error,
    });
    return NextResponse.json(
      { error: "Unable to submit the activity", code: "SUBMISSION_FAILED" },
      { status: 500 },
    );
  }
}
