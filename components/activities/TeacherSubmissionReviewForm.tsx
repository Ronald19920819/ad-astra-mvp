"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { TeacherSubmissionReview } from "@/lib/supabase/activityReviewReader";
import {
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

export default function TeacherSubmissionReviewForm({
  review,
  subjectKey = "business-studies",
}: {
  review: TeacherSubmissionReview;
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const router = useRouter();
  const isReturned = review.status === "returned";
  const [teacherMarks, setTeacherMarks] = useState<Record<string, string>>(
    Object.fromEntries(
      review.questions.map((question) => [
        question.answer.id,
        String(question.answer.teacherMark ?? question.answer.kingdomMark ?? ""),
      ]),
    ),
  );
  const [teacherFeedback, setTeacherFeedback] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      review.questions.map((question) => [
        question.answer.id,
        question.answer.teacherFeedback ?? "",
      ]),
    ),
  );
  const [teacherComment, setTeacherComment] = useState(
    review.teacherComment ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  async function returnToLearner() {
    if (isReturned || isReturning) return;

    const errors: Record<string, string> = {};
    const answers = review.questions.map((question) => {
      const markValue = teacherMarks[question.answer.id]?.trim() ?? "";
      const teacherMark = Number(markValue);

      if (
        !markValue ||
        !Number.isInteger(teacherMark) ||
        teacherMark < 0 ||
        teacherMark > question.maximumMarks
      ) {
        errors[question.answer.id] = `Enter a whole number from 0 to ${question.maximumMarks}.`;
      }

      return {
        answerId: question.answer.id,
        teacherMark,
        teacherFeedback: teacherFeedback[question.answer.id] ?? "",
      };
    });

    setFieldErrors(errors);
    setSubmitError("");
    if (Object.keys(errors).length > 0) return;

    try {
      setIsReturning(true);
      const response = await fetch(
        `/api/teacher/business-studies/reviews/${review.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId: subject.databaseId,
            answers,
            teacherComment,
          }),
        },
      );
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "The reviewed submission could not be returned.",
        );
      }

      router.push(subject.routes.teacherReview);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The reviewed submission could not be returned.",
      );
    } finally {
      setIsReturning(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        {review.questions.map((question) => (
          <section
            key={question.id}
            className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold text-slate-900">
                  Question {question.questionNumber}
                </h2>
                <span className="shrink-0 text-xs font-bold text-orange-500">
                  {question.maximumMarks} marks
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                {question.questionText}
              </p>
              {question.assessmentObjective && (
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-orange-500">
                  {question.assessmentObjective}
                </p>
              )}
            </div>

            <div className="mb-4 rounded-2xl bg-slate-50 p-4">
              <p className="mb-1 text-xs font-bold text-slate-500">
                Learner Answer
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {question.answer.answerText}
              </p>
            </div>

            <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="text-orange-500" size={17} />
                <p className="text-sm font-bold text-slate-900">
                  Kingdom Preliminary Assessment
                </p>
              </div>
              <p className="mb-2 text-sm leading-6 text-slate-700">
                {question.answer.kingdomFeedback ?? "No Kingdom feedback available."}
              </p>
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                {question.answer.kingdomMark ?? 0}/{question.maximumMarks}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-bold text-slate-900">
                Teacher Final Review
              </p>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Teacher Mark
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={0}
                  max={question.maximumMarks}
                  disabled={isReturned}
                  value={teacherMarks[question.answer.id] ?? ""}
                  onChange={(event) => {
                    setTeacherMarks((current) => ({
                      ...current,
                      [question.answer.id]: event.target.value,
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      [question.answer.id]: "",
                    }));
                  }}
                  className="w-20 rounded-2xl border border-slate-200 p-3 text-center text-sm font-bold outline-none focus:border-orange-300 disabled:bg-slate-100"
                />
                <span className="text-sm font-semibold text-slate-600">
                  /{question.maximumMarks}
                </span>
              </div>
              {fieldErrors[question.answer.id] && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {fieldErrors[question.answer.id]}
                </p>
              )}

              <label className="mb-2 mt-4 block text-xs font-semibold text-slate-600">
                Teacher Comment
              </label>
              <textarea
                disabled={isReturned}
                value={teacherFeedback[question.answer.id] ?? ""}
                onChange={(event) =>
                  setTeacherFeedback((current) => ({
                    ...current,
                    [question.answer.id]: event.target.value,
                  }))
                }
                placeholder="Confirm or adjust Kingdom's feedback..."
                className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-300 disabled:bg-slate-100"
              />
            </div>
          </section>
        ))}
      </div>

      <section className="mt-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-bold text-slate-900">
          Teacher&apos;s overall comment
        </label>
        <textarea
          disabled={isReturned}
          value={teacherComment}
          onChange={(event) => setTeacherComment(event.target.value)}
          placeholder="Add an overall comment for the learner..."
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-300 disabled:bg-slate-100"
        />

        {isReturned ? (
          <p className="mt-4 rounded-2xl bg-green-50 p-3 text-center text-sm font-bold text-green-700">
            Status: Returned
          </p>
        ) : (
          <button
            type="button"
            onClick={returnToLearner}
            disabled={isReturning}
            className="mt-4 w-full rounded-2xl bg-orange-500 py-4 font-bold text-white shadow-sm disabled:cursor-wait disabled:opacity-60"
          >
            {isReturning ? "Returning..." : "Return to Learner"}
          </button>
        )}

        {submitError && (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {submitError}
          </p>
        )}
      </section>
    </>
  );
}
