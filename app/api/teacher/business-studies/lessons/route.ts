import {
  isLessonReadingPdfPath,
  LESSON_READING_PDF_BUCKET,
} from "@/lib/lessons/pdfReading";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  getLessonQuizCorrectAnswerText,
  isCompleteLessonQuizQuestion,
} from "@/lib/lessons/lessonQuiz";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalid(error: string) {
  return Response.json({ error, code: "INVALID_REQUEST" }, { status: 400 });
}

function isOptionalDate(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  );
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalid("Malformed JSON request body.");
    }

    if (!isRecord(body) || typeof body.action !== "string") {
      return invalid("A valid lesson action is required.");
    }
    const subjectId = body.subjectId;
    if (
      typeof subjectId !== "string" ||
      !uuidPattern.test(subjectId) ||
      !getSubjectConfigurationByDatabaseId(subjectId)
    ) {
      return invalid("A supported subject is required.");
    }
    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      return teacherAuthorizationResponse(authorization);
    }
    const subject = getSubjectConfigurationByDatabaseId(subjectId)!;

    const { admin } = authorization.teacher;
    const topicBelongsToSubject = async (topicId: string) => {
      const { data, error } = await admin
        .from("subject_topics")
        .select("id")
        .eq("id", topicId)
        .eq("subject_id", subjectId)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    };

    if (body.action === "create") {
      const lessonNumber = body.lessonNumber;
      const title = body.title;
      const description = body.description;
      const displayOrder = body.displayOrder;
      const termNumber = body.termNumber;
      const weekNumber = body.weekNumber;
      const status = body.status;
      const topicId = body.topicId;
      const expectedCompletionDate = body.expectedCompletionDate;

      if (
        typeof lessonNumber !== "string" ||
        !lessonNumber.trim() ||
        lessonNumber.length > 50 ||
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 300 ||
        (description !== undefined && typeof description !== "string") ||
        (displayOrder !== undefined && !Number.isInteger(displayOrder)) ||
        !Number.isInteger(termNumber) ||
        Number(termNumber) <= 0 ||
        !Number.isInteger(weekNumber) ||
        Number(weekNumber) <= 0 ||
        (topicId !== null &&
          topicId !== undefined &&
          (typeof topicId !== "string" || !uuidPattern.test(topicId))) ||
        !isOptionalDate(expectedCompletionDate) ||
        (status !== "draft" && status !== "published")
      ) {
        return invalid("Invalid lesson details.");
      }

      if (
        typeof topicId === "string" &&
        !(await topicBelongsToSubject(topicId))
      ) {
        return invalid(`Select a valid ${subject.displayName} topic.`);
      }

      const { data, error } = await admin
        .from("lessons")
        .insert({
          subject_id: subjectId,
          lesson_number: lessonNumber.trim(),
          title: title.trim(),
          description: description?.trim() ?? "",
          display_order: displayOrder ?? 0,
          term_number: termNumber,
          week_number: weekNumber,
          topic_id: typeof topicId === "string" ? topicId : null,
          expected_completion_date:
            typeof expectedCompletionDate === "string"
              ? expectedCompletionDate
              : null,
          status,
        })
        .select()
        .single();

      if (error) throw error;
      return Response.json({ success: true, data });
    }

    const lessonId = body.lessonId;
    if (typeof lessonId !== "string" || !uuidPattern.test(lessonId)) {
      return invalid("A valid lesson ID is required.");
    }

    const { data: lesson, error: lessonError } = await admin
      .from("lessons")
      .select("id, title, status")
      .eq("id", lessonId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (!lesson) {
      return Response.json(
        { error: `The ${subject.displayName} lesson was not found.`, code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (body.action === "material") {
      const materialType = body.materialType;
      const sourceType = body.sourceType;
      const title = body.title;
      const required = body.required;
      const contentUrl = body.contentUrl;
      const contentText = body.contentText;
      const displayOrder = body.displayOrder;

      if (
        !["reading", "video", "quiz"].includes(String(materialType)) ||
        !["pasted_text", "pdf", "youtube"].includes(String(sourceType)) ||
        typeof title !== "string" ||
        !title.trim() ||
        typeof required !== "boolean" ||
        (contentUrl !== null &&
          contentUrl !== undefined &&
          typeof contentUrl !== "string") ||
        (contentText !== null &&
          contentText !== undefined &&
          typeof contentText !== "string") ||
        (displayOrder !== undefined && !Number.isInteger(displayOrder))
      ) {
        return invalid("Invalid lesson material details.");
      }

      const { data: existing, error: existingError } = await admin
        .from("lesson_materials")
        .select("id, source_type, content_url")
        .eq("lesson_id", lessonId)
        .eq("material_type", materialType)
        .maybeSingle();

      if (existingError) throw existingError;
      const values = {
        source_type: sourceType,
        title: title.trim(),
        required,
        content_url: typeof contentUrl === "string" ? contentUrl : null,
        content_text: typeof contentText === "string" ? contentText : null,
        display_order: displayOrder ?? 0,
      };
      const result = existing
        ? await admin
            .from("lesson_materials")
            .update(values)
            .eq("id", existing.id)
            .select()
            .single()
        : await admin
            .from("lesson_materials")
            .insert({
              lesson_id: lessonId,
              material_type: materialType,
              ...values,
            })
            .select()
            .single();

      if (result.error) throw result.error;

      if (
        materialType === "reading" &&
        existing?.source_type === "pdf" &&
        sourceType !== "pdf" &&
        typeof existing.content_url === "string" &&
        isLessonReadingPdfPath(existing.content_url, subjectId, lessonId)
      ) {
        const { error: cleanupError } = await admin.storage
          .from(LESSON_READING_PDF_BUCKET)
          .remove([existing.content_url]);
        if (cleanupError) {
          console.warn("Replaced lesson PDF cleanup failed:", {
            lessonId,
            message: cleanupError.message,
          });
        }
      }

      return Response.json({ success: true, data: result.data });
    }

    if (body.action === "details") {
      const lessonNumber = body.lessonNumber;
      const title = body.title;
      const termNumber = body.termNumber;
      const weekNumber = body.weekNumber;
      const topicId = body.topicId;
      const expectedCompletionDate = body.expectedCompletionDate;

      if (
        typeof lessonNumber !== "string" ||
        !lessonNumber.trim() ||
        lessonNumber.length > 50 ||
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 300 ||
        !Number.isInteger(termNumber) ||
        Number(termNumber) <= 0 ||
        !Number.isInteger(weekNumber) ||
        Number(weekNumber) <= 0 ||
        (topicId !== null &&
          topicId !== undefined &&
          (typeof topicId !== "string" || !uuidPattern.test(topicId))) ||
        !isOptionalDate(expectedCompletionDate)
      ) {
        return invalid("Invalid lesson details.");
      }

      if (
        typeof topicId === "string" &&
        !(await topicBelongsToSubject(topicId))
      ) {
        return invalid(`Select a valid ${subject.displayName} topic.`);
      }

      const lessonUpdates: {
        lesson_number: string;
        title: string;
        term_number: number;
        week_number: number;
        expected_completion_date: string | null;
        topic_id?: string | null;
      } = {
        lesson_number: lessonNumber.trim(),
        title: title.trim(),
        term_number: Number(termNumber),
        week_number: Number(weekNumber),
        expected_completion_date:
          typeof expectedCompletionDate === "string"
            ? expectedCompletionDate
            : null,
      };
      if (topicId !== undefined) {
        lessonUpdates.topic_id =
          typeof topicId === "string" ? topicId : null;
      }

      const { data, error } = await admin
        .from("lessons")
        .update(lessonUpdates)
        .eq("id", lessonId)
        .eq("subject_id", subjectId)
        .select("id")
        .single();

      if (error) throw error;
      return Response.json({ success: true, data });
    }

    if (body.action === "status") {
      if (body.status !== "draft" && body.status !== "published") {
        return invalid("A valid lesson status is required.");
      }

      const { data, error } = await admin
        .from("lessons")
        .update({ status: body.status })
        .eq("id", lessonId)
        .eq("subject_id", subjectId)
        .select("id, status")
        .single();

      if (error) throw error;
      return Response.json({ success: true, data });
    }

    if (body.action === "quiz") {
      const questions = body.questions;
      const lessonTitle = body.lessonTitle;
      if (
        typeof lessonTitle !== "string" ||
        !lessonTitle.trim() ||
        !Array.isArray(questions) ||
        questions.length !== 5 ||
        !questions.every(
          (question) =>
            isRecord(question) &&
            (question.questionId === undefined ||
              (typeof question.questionId === "string" &&
                uuidPattern.test(question.questionId))) &&
            isCompleteLessonQuizQuestion(question),
        )
      ) {
        return invalid("A complete 5-question lesson quiz is required.");
      }

      const { data: existingQuiz, error: existingQuizError } = await admin
        .from("lesson_materials")
        .select("id")
        .eq("lesson_id", lessonId)
        .eq("material_type", "quiz")
        .maybeSingle();

      if (existingQuizError) throw existingQuizError;
      if (existingQuiz) {
        const { data: existingActivity, error: existingActivityError } =
          await admin
            .from("activities")
            .select("id")
            .eq("lesson_material_id", existingQuiz.id)
            .maybeSingle();

        if (existingActivityError) throw existingActivityError;
        if (!existingActivity) {
          throw new Error("The existing lesson quiz activity is missing.");
        }

        const { data: existingQuestions, error: existingQuestionsError } =
          await admin
            .from("activity_questions")
            .select("id")
            .eq("activity_id", existingActivity.id);
        if (existingQuestionsError) throw existingQuestionsError;

        const existingQuestionIds = new Set(
          (existingQuestions ?? []).map((question) => question.id),
        );
        const submittedQuestionIds = new Set(
          questions
            .map((question) =>
              isRecord(question) && typeof question.questionId === "string"
                ? question.questionId
                : null,
            )
            .filter((questionId): questionId is string => Boolean(questionId)),
        );

        if (
          [...submittedQuestionIds].some(
            (questionId) => !existingQuestionIds.has(questionId),
          )
        ) {
          return invalid("The lesson quiz contains an invalid question ID.");
        }

        const removedQuestionIds = [...existingQuestionIds].filter(
          (questionId) => !submittedQuestionIds.has(questionId),
        );
        if (removedQuestionIds.length > 0) {
          const { data: submission, error: submissionError } = await admin
            .from("activity_submissions")
            .select("id")
            .eq("activity_id", existingActivity.id)
            .limit(1)
            .maybeSingle();
          if (submissionError) throw submissionError;
          if (submission) {
            return Response.json(
              {
                error:
                  "Quiz questions cannot be removed after learner submissions exist.",
                code: "QUESTIONS_IN_USE",
              },
              { status: 409 },
            );
          }
        }

        const { error: materialUpdateError } = await admin
          .from("lesson_materials")
          .update({
            source_type: "pasted_text",
            title: `${lessonTitle.trim()} Quiz`,
            required: true,
            display_order: 3,
          })
          .eq("id", existingQuiz.id);
        if (materialUpdateError) throw materialUpdateError;

        const { error: activityUpdateError } = await admin
          .from("activities")
          .update({
            title: `${lessonTitle.trim()} Quiz`,
            instructions: "Choose the correct answer for each of the 5 questions.",
            total_marks: 5,
          })
          .eq("id", existingActivity.id);
        if (activityUpdateError) throw activityUpdateError;

        const questionRows = questions.map((question, index) => ({
          id:
            isRecord(question) && typeof question.questionId === "string"
              ? question.questionId
              : crypto.randomUUID(),
          activity_id: existingActivity.id,
          question_number: index + 1,
          question_text: String(
            isRecord(question) ? question.questionText : "",
          ).trim(),
          answer_text: getLessonQuizCorrectAnswerText({
            optionA: String(isRecord(question) ? question.optionA : "").trim(),
            optionB: String(isRecord(question) ? question.optionB : "").trim(),
            optionC: String(isRecord(question) ? question.optionC : "").trim(),
            optionD: String(isRecord(question) ? question.optionD : "").trim(),
            correctOption: String(
              isRecord(question) ? question.correctOption : "",
            ).trim() as "A" | "B" | "C" | "D",
          }),
          option_a: String(isRecord(question) ? question.optionA : "").trim(),
          option_b: String(isRecord(question) ? question.optionB : "").trim(),
          option_c: String(isRecord(question) ? question.optionC : "").trim(),
          option_d: String(isRecord(question) ? question.optionD : "").trim(),
          correct_option: String(
            isRecord(question) ? question.correctOption : "",
          ).trim(),
          marks: 1,
          display_order: index + 1,
          assessment_objective: null,
          guidance: null,
          paper: null,
          question_type: "multiple_choice",
        }));
        const { error: questionUpsertError } = await admin
          .from("activity_questions")
          .upsert(questionRows, { onConflict: "id" });
        if (questionUpsertError) throw questionUpsertError;

        if (removedQuestionIds.length > 0) {
          const { error: questionDeleteError } = await admin
            .from("activity_questions")
            .delete()
            .in("id", removedQuestionIds)
            .eq("activity_id", existingActivity.id);
          if (questionDeleteError) throw questionDeleteError;
        }

        return Response.json({ success: true, data: existingActivity });
      }

      const { data: quizMaterial, error: materialError } = await admin
        .from("lesson_materials")
        .insert({
          lesson_id: lessonId,
          material_type: "quiz",
          source_type: "pasted_text",
          title: `${lessonTitle.trim()} Quiz`,
          required: true,
          display_order: 3,
        })
        .select("id")
        .single();

      if (materialError) throw materialError;
      const { data: activity, error: activityError } = await admin
        .from("activities")
        .insert({
          title: `${lessonTitle.trim()} Quiz`,
          instructions: "Choose the correct answer for each of the 5 questions.",
          total_marks: 5,
          lesson_material_id: quizMaterial.id,
          due_date: null,
        })
        .select("id")
        .single();

      if (activityError) throw activityError;
      const questionRows = questions.map((question, index) => ({
        activity_id: activity.id,
        question_number: index + 1,
        question_text: String(question.questionText).trim(),
        answer_text: getLessonQuizCorrectAnswerText({
          optionA: String(question.optionA).trim(),
          optionB: String(question.optionB).trim(),
          optionC: String(question.optionC).trim(),
          optionD: String(question.optionD).trim(),
          correctOption: question.correctOption,
        }),
        option_a: String(question.optionA).trim(),
        option_b: String(question.optionB).trim(),
        option_c: String(question.optionC).trim(),
        option_d: String(question.optionD).trim(),
        correct_option: question.correctOption,
        marks: 1,
        display_order: index + 1,
        assessment_objective: null,
        guidance: null,
        paper: null,
        question_type: "multiple_choice",
      }));
      const { error: questionsError } = await admin
        .from("activity_questions")
        .insert(questionRows);

      if (questionsError) throw questionsError;
      return Response.json({ success: true, data: activity });
    }

    return invalid("Unsupported lesson action.");
  } catch (error) {
    console.error("Subject lesson write failed:", error);
    return Response.json(
      { error: "The lesson change could not be saved.", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}
