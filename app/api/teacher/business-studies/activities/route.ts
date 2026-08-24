import { validateRequiredDueDate } from "@/lib/activities/dueDateValidation";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const subjectId = new URL(request.url).searchParams.get("subjectId");
    if (!subjectId || !getSubjectConfigurationByDatabaseId(subjectId)) {
      return Response.json(
        { error: "A supported subject is required.", code: "INVALID_SUBJECT" },
        { status: 400 },
      );
    }

    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const { admin } = authorization.teacher;
    const { data: activities, error: activitiesError } = await admin
      .from("activities")
      .select(`
        id,
        version,
        title,
        total_marks,
        due_date,
        lesson_material_id,
        created_at,
        lesson_materials!inner (
          material_type,
          lessons!inner (
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

    const activityIds = (activities ?? []).map((activity) => activity.id);
    const submissionCounts = new Map<string, number>();
    if (activityIds.length > 0) {
      const { data: submissions, error: submissionsError } = await admin
        .from("activity_submissions")
        .select("activity_id")
        .in("activity_id", activityIds);
      if (submissionsError) throw submissionsError;

      for (const submission of submissions ?? []) {
        submissionCounts.set(
          submission.activity_id,
          (submissionCounts.get(submission.activity_id) ?? 0) + 1,
        );
      }
    }

    return Response.json({
      data: (activities ?? []).map((activity) => ({
        id: activity.id,
        version: activity.version,
        title: activity.title,
        total_marks: activity.total_marks,
        due_date: activity.due_date,
        lesson_material_id: activity.lesson_material_id,
        created_at: activity.created_at,
        submissionCount: submissionCounts.get(activity.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Subject activities loading failed:", error);
    return Response.json(
      {
        error: "Published activities could not be loaded.",
        code: "LOAD_FAILED",
      },
      { status: 500 },
    );
  }
}

type SubmittedQuestion = {
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

export async function POST(request: Request) {
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
    // not be publishable without a valid due date -- a blank string is
    // NOT accepted (typeof === "string" alone is not enough). This due
    // date becomes authoritative for BOTH the activity and its linked
    // lesson (see the lessons.expected_completion_date write below), so
    // the teacher never has to enter it twice or risk it diverging.
    const dueDateValidation = validateRequiredDueDate(dueDate);
    if (!dueDateValidation.valid) {
      return Response.json(
        {
          error: "A valid due date is required to publish this activity.",
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

    const { data: activity, error: activityError } = await admin
      .from("activities")
      .insert({
        title: title.trim(),
        instructions: instructions.trim(),
        total_marks: totalMarks,
        lesson_material_id: readingMaterial.id,
        due_date: dueDateValidation.dueDate,
      })
      .select("id")
      .single();

    if (activityError) throw activityError;

    // Write the SAME authoritative due date to the linked lesson so the
    // pair can never diverge -- lessons.expected_completion_date and
    // activities.due_date remain two columns (many existing readers
    // depend on both), but this activity flow is the one place a
    // Coin-eligible pair's date is actually set, so it stays the single
    // source of truth applied to both.
    const { error: lessonDueDateError } = await admin
      .from("lessons")
      .update({ expected_completion_date: dueDateValidation.dueDate })
      .eq("id", lessonId);
    if (lessonDueDateError) throw lessonDueDateError;

    const questionRows = questions.map((question, index) => ({
      activity_id: activity.id,
      question_number: index + 1,
      paper: question.paper,
      question_type: question.questionType,
      question_text: question.questionText.trim(),
      marks: question.marks,
      assessment_objective: question.ao,
      guidance: question.guidance,
      display_order: index + 1,
    }));
    const { error: questionsError } = await admin
      .from("activity_questions")
      .insert(questionRows);

    if (questionsError) {
      await admin.from("activities").delete().eq("id", activity.id);
      throw questionsError;
    }

    return Response.json({ success: true, data: activity });
  } catch (error) {
    console.error("Subject activity publish failed:", error);
    return Response.json(
      { error: "The activity could not be published.", code: "PUBLISH_FAILED" },
      { status: 500 },
    );
  }
}
