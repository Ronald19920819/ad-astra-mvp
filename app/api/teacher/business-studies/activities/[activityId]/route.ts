import { validateRequiredDueDate } from "@/lib/activities/dueDateValidation";
import { deletePublishedSubjectActivity } from "@/lib/supabase/publishedContentDeleter";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubmittedQuestion = {
  questionId?: string;
  paper: string;
  questionType: string;
  questionText: string;
  marks: number;
  ao: string;
  guidance: string;
};

function isQuestion(value: unknown): value is SubmittedQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const question = value as Record<string, unknown>;
  return (
    (question.questionId === undefined ||
      (typeof question.questionId === "string" &&
        uuidPattern.test(question.questionId))) &&
    typeof question.paper === "string" &&
    Boolean(question.paper) &&
    typeof question.questionType === "string" &&
    Boolean(question.questionType) &&
    typeof question.questionText === "string" &&
    Boolean(question.questionText.trim()) &&
    typeof question.marks === "number" &&
    Number.isInteger(question.marks) &&
    question.marks > 0 &&
    typeof question.ao === "string" &&
    typeof question.guidance === "string"
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ activityId: string }> },
) {
  const { activityId } = await context.params;
  if (!activityId || !uuidPattern.test(activityId)) {
    return Response.json(
      { error: "A valid activity ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Malformed JSON request body.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Invalid activity details.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const subjectId = payload.subjectId;
    const title = payload.title;
    const instructions = payload.instructions;
    const lessonId = payload.lessonId;
    const totalMarks = payload.totalMarks;
    const dueDate = payload.dueDate;
    const questions = payload.questions;
    const confirmedSubmissionImpact = payload.confirmedSubmissionImpact;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof instructions !== "string" ||
      !instructions.trim() ||
      typeof lessonId !== "string" ||
      !uuidPattern.test(lessonId) ||
      !Number.isInteger(totalMarks) ||
      Number(totalMarks) <= 0 ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      questions.length > 100 ||
      !questions.every(isQuestion) ||
      questions.reduce((sum, question) => sum + question.marks, 0) !== totalMarks ||
      typeof subjectId !== "string" ||
      !getSubjectConfigurationByDatabaseId(subjectId)
    ) {
      return Response.json(
        { error: "Invalid activity details.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    // Locked reward-integrity policy: a linked lesson/activity pair must
    // not be publishable without a valid due date -- see
    // lib/activities/dueDateValidation.ts. Editing an activity can never
    // clear or blank its due date.
    const dueDateValidation = validateRequiredDueDate(dueDate);
    if (!dueDateValidation.valid) {
      return Response.json(
        {
          error: "A valid due date is required to save this activity.",
          code: "INVALID_DUE_DATE",
        },
        { status: 400 },
      );
    }
    const subject = getSubjectConfigurationByDatabaseId(subjectId)!;
    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }

    const { admin } = authorization.teacher;
    const { data: activity, error: activityError } = await admin
      .from("activities")
      .select(`
        id,
        version,
        title,
        instructions,
        total_marks,
        due_date,
        lesson_material_id
      `)
      .eq("id", activityId)
      .maybeSingle();
    if (activityError) throw activityError;
    if (!activity) {
      return Response.json(
        { error: "The activity was not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: currentMaterial, error: currentMaterialError } = await admin
      .from("lesson_materials")
      .select("lesson_id")
      .eq("id", activity.lesson_material_id)
      .maybeSingle();
    if (currentMaterialError) throw currentMaterialError;
    if (!currentMaterial) {
      return Response.json(
        { error: `The ${subject.displayName} activity was not found.`, code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: currentLesson, error: currentLessonError } = await admin
      .from("lessons")
      .select("id")
      .eq("id", currentMaterial.lesson_id)
      .eq("subject_id", subjectId)
      .maybeSingle();
    if (currentLessonError) throw currentLessonError;
    if (!currentLesson) {
      return Response.json(
        { error: `The ${subject.displayName} activity was not found.`, code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: lesson, error: lessonError } = await admin
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("subject_id", subjectId)
      .eq("status", "published")
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) {
      return Response.json(
        { error: `Select a published ${subject.displayName} lesson.`, code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: readingMaterial, error: readingError } = await admin
      .from("lesson_materials")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("material_type", "reading")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readingError) throw readingError;
    if (!readingMaterial) {
      return Response.json(
        {
          error: "The selected lesson has no reading material to link to this activity.",
          code: "MISSING_READING",
        },
        { status: 422 },
      );
    }

    const { data: existingQuestions, error: existingQuestionsError } =
      await admin
        .from("activity_questions")
        .select(`
          id,
          question_number,
          paper,
          question_type,
          question_text,
          marks,
          assessment_objective,
          guidance,
          display_order
        `)
        .eq("activity_id", activityId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("question_number", { ascending: true });
    if (existingQuestionsError) throw existingQuestionsError;

    const existingQuestionIds = new Set(
      (existingQuestions ?? []).map((question) => question.id),
    );
    const submittedQuestionIds = questions
      .map((question) => question.questionId)
      .filter((questionId): questionId is string => Boolean(questionId));
    if (
      new Set(submittedQuestionIds).size !== submittedQuestionIds.length ||
      submittedQuestionIds.some(
        (questionId) => !existingQuestionIds.has(questionId),
      )
    ) {
      return Response.json(
        { error: "The activity contains invalid question IDs.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const { count: submissionCount, error: submissionCountError } =
      await admin
        .from("activity_submissions")
        .select("id", { count: "exact", head: true })
        .eq("activity_id", activityId);
    if (submissionCountError) throw submissionCountError;
    if (
      (submissionCount ?? 0) > 0 &&
      confirmedSubmissionImpact !== true
    ) {
      return Response.json(
        {
          error:
            "This activity already has learner submissions. Confirm that your changes should apply only to future submissions.",
          code: "CONFIRM_SUBMISSION_IMPACT",
          submissionCount,
        },
        { status: 409 },
      );
    }

    const questionRows = questions.map((question, index) => ({
      id: question.questionId ?? crypto.randomUUID(),
      activity_id: activityId,
      question_number: index + 1,
      paper: question.paper,
      question_type: question.questionType,
      question_text: question.questionText.trim(),
      marks: question.marks,
      assessment_objective: question.ao,
      guidance: question.guidance,
      display_order: index + 1,
    }));
    const materialChanged =
      activity.title !== title.trim() ||
      (activity.instructions ?? "") !== instructions.trim() ||
      activity.total_marks !== totalMarks ||
      activity.lesson_material_id !== readingMaterial.id ||
      existingQuestions.length !== questionRows.length ||
      questionRows.some((question, index) => {
        const existingQuestion = existingQuestions[index];
        return (
          !existingQuestion ||
          existingQuestion.id !== question.id ||
          existingQuestion.question_number !== question.question_number ||
          existingQuestion.paper !== question.paper ||
          existingQuestion.question_type !== question.question_type ||
          existingQuestion.question_text !== question.question_text ||
          existingQuestion.marks !== question.marks ||
          existingQuestion.assessment_objective !==
            question.assessment_objective ||
          (existingQuestion.guidance ?? "") !== question.guidance ||
          existingQuestion.display_order !== question.display_order
        );
      });

    let version = activity.version;
    if (materialChanged) {
      const { data: updatedVersion, error: updateError } = await admin.rpc(
        "update_activity_material_version",
        {
          p_activity_id: activityId,
          p_title: title.trim(),
          p_instructions: instructions.trim(),
          p_total_marks: totalMarks,
          p_lesson_material_id: readingMaterial.id,
          p_due_date: dueDateValidation.dueDate,
          p_questions: questionRows,
        },
      );
      if (updateError) throw updateError;
      version = Number(updatedVersion);
    } else if ((activity.due_date ?? "") !== dueDateValidation.dueDate) {
      const { error: dueDateError } = await admin
        .from("activities")
        .update({ due_date: dueDateValidation.dueDate })
        .eq("id", activityId);
      if (dueDateError) throw dueDateError;
    }

    // Keep the linked lesson's due date in lockstep, the same as the
    // create path -- whichever branch above ran, the activity's due date
    // is now dueDateValidation.dueDate, so the lesson must match it too.
    const { error: lessonDueDateError } = await admin
      .from("lessons")
      .update({ expected_completion_date: dueDateValidation.dueDate })
      .eq("id", lessonId);
    if (lessonDueDateError) throw lessonDueDateError;

    return Response.json({
      success: true,
      data: {
        id: activityId,
        version,
        materialChanged,
        submissionCount: submissionCount ?? 0,
      },
    });
  } catch (error) {
    console.error("Subject activity update failed:", {
      activityId,
      error,
    });
    return Response.json(
      { error: "The activity changes could not be saved.", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ activityId: string }> },
) {
  const { activityId } = await context.params;

  if (!activityId || !uuidPattern.test(activityId)) {
    return Response.json(
      { error: "A valid activity ID is required.", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const subjectId = new URL(request.url).searchParams.get("subjectId");
    if (!subjectId || !getSubjectConfigurationByDatabaseId(subjectId)) {
      return Response.json(
        { error: "A supported subject is required.", code: "INVALID_SUBJECT" },
        { status: 400 },
      );
    }
    const result = await deletePublishedSubjectActivity(subjectId, activityId);

    if (!result.success) {
      return Response.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Published subject activity deletion failed:", {
      activityId,
      error,
    });
    return Response.json(
      {
        error: "The activity could not be deleted. Please try again.",
        code: "DELETE_FAILED",
      },
      { status: 500 },
    );
  }
}
