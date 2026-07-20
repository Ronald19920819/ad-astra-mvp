"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Clock, SquarePen } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerActivityData,
  type LearnerActivityWorkspaceData,
} from "@/lib/supabase/activityReader";

const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isDevelopment = process.env.NODE_ENV === "development";

const activityStateMessages = {
  invalid: "This activity link is invalid.",
  "not-found": "This activity could not be found.",
  unpublished: "This activity is not available to learners.",
  "wrong-subject": "This activity is not a Business Studies activity.",
  "missing-reading": "This activity has no reading material available.",
  error: "We could not load this activity. Please try again.",
} as const;

type ActivityState = keyof typeof activityStateMessages;

type SavedSubmissionAnswer = {
  id: string;
  question_id: string;
  answer_text: string;
  kingdom_mark: number | null;
  kingdom_feedback: string | null;
  kingdom_judgement: "correct" | "partially_correct" | "incorrect" | null;
  teacher_mark: number | null;
  teacher_feedback: string | null;
};

type SavedActivitySubmission = {
  id: string;
  activity_id: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
  submitted_at: string;
  preliminary_mark: number | null;
  preliminary_total: number | null;
  preliminary_percentage: number | null;
  kingdom_marked_at: string | null;
  final_mark: number | null;
  reviewed_at: string | null;
  activity_submission_answers: SavedSubmissionAnswer[];
};

export default function BusinessStudiesActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const [activityData, setActivityData] =
    useState<LearnerActivityWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageState, setPageState] = useState<ActivityState | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submission, setSubmission] =
    useState<SavedActivitySubmission | null>(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionAccessBlocked, setSubmissionAccessBlocked] = useState(false);

  function applySavedSubmission(savedSubmission: SavedActivitySubmission) {
    setSubmission(savedSubmission);
    setAnswers(
      Object.fromEntries(
        savedSubmission.activity_submission_answers.map((answer) => [
          answer.question_id,
          answer.answer_text,
        ]),
      ),
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadActivity() {
      if (!activityId || !uuidPattern.test(activityId)) {
        if (isActive) {
          setPageState("invalid");
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setPageState(null);
        const result = await getLearnerActivityData(
          activityId,
          businessStudiesSubjectId,
        );

        if (!isActive) return;

        if (result.status === "success") {
          setActivityData(result.data);
        } else {
          setActivityData(null);
          setPageState(result.status);
        }
      } catch (error) {
        console.error("Unable to load learner Business Studies activity:", error);
        if (isActive) {
          setActivityData(null);
          setPageState("error");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadActivity();

    return () => {
      isActive = false;
    };
  }, [activityId]);

  useEffect(() => {
    let isActive = true;

    async function loadSubmission() {
      if (!activityId || !uuidPattern.test(activityId)) {
        if (isActive) setIsLoadingSubmission(false);
        return;
      }

      try {
        setIsLoadingSubmission(true);
        const response = await fetch(
          `/api/kingdom/mark-activity?activityId=${encodeURIComponent(activityId)}`,
        );
        const result = (await response.json()) as {
          submission?: SavedActivitySubmission | null;
          error?: string;
          code?: string;
        };

        if (!isActive) return;

        if (!response.ok) {
          setSubmissionAccessBlocked(true);
          setSubmissionMessage(
            result.error || "Unable to load your activity submission.",
          );
          return;
        }

        setSubmissionAccessBlocked(false);
        if (result.submission) applySavedSubmission(result.submission);
      } catch (error) {
        console.error("Unable to load saved activity submission:", error);
        if (isActive) {
          setSubmissionAccessBlocked(true);
          setSubmissionMessage("Unable to load your activity submission.");
        }
      } finally {
        if (isActive) setIsLoadingSubmission(false);
      }
    }

    loadSubmission();

    return () => {
      isActive = false;
    };
  }, [activityId]);

  async function submitActivity() {
    if (!activityData || submission || isSubmitting) return;

    const hasBlankAnswer = activityData.questions.some(
      (question) => !answers[question.id]?.trim(),
    );

    if (hasBlankAnswer) {
      setSubmissionMessage("Please answer every question before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmissionMessage("");
      const response = await fetch("/api/kingdom/mark-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          answers: activityData.questions.map((question) => ({
            questionId: question.id,
            answerText: answers[question.id].trim(),
          })),
        }),
      });
      const result = (await response.json()) as {
        submission?: SavedActivitySubmission | null;
        error?: string;
        saved?: boolean;
        code?: string;
      };

      if (result.submission) applySavedSubmission(result.submission);

      if (!response.ok) {
        if (result.code === "UNAUTHORIZED") setSubmissionAccessBlocked(true);
        throw new Error(
          result.error ||
            (result.saved
              ? "Your activity was saved, but marking is still pending."
              : "Unable to submit the activity."),
        );
      }

      setSubmissionMessage("");
    } catch (error) {
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit the activity.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}
      >
        <div className="mx-auto max-w-md rounded-[2rem] border border-orange-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Loading activity...
        </div>
      </main>
    );
  }

  if (pageState || !activityData) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}
      >
        <div className="mx-auto max-w-md rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href="/business-studies-activities"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} /> Back to Activities
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Activity unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {activityStateMessages[pageState ?? "error"]}
          </p>
        </div>
      </main>
    );
  }

  const { activity, reading, lesson, questions } = activityData;
  const hasSchedule =
    lesson.term_number !== null && lesson.week_number !== null;

  return (
    <main
      className={`${neueHaas.className} min-h-screen w-full overflow-x-clip bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="mx-auto w-full min-w-0 max-w-md">
        <section className="mb-5 w-full min-w-0 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href="/business-studies-activities"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} /> Back to Activities
          </Link>
          <h1 className="break-words text-3xl font-bold text-slate-900">
            {activity.title}
          </h1>
          <p className="mt-1 break-words text-lg font-semibold text-slate-700">
            Lesson {lesson.lesson_number} &mdash; {lesson.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
            {hasSchedule && (
              <span>
                Term {lesson.term_number} &middot; Week {lesson.week_number}
              </span>
            )}
            <span>{activity.total_marks} marks</span>
            {activity.due_date && (
              <span className="inline-flex items-center gap-1 text-orange-500">
                <Clock size={14} />
                Due{" "}
                {new Date(activity.due_date).toLocaleDateString("en-ZA", {
                  timeZone: "UTC",
                })}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Business Studies Activity Workspace
          </p>
        </section>

        {isDevelopment && (
          <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Development testing mode: activity submissions are being recorded
            against the configured test learner.
          </p>
        )}

        <section className="mb-5 w-full min-w-0 overflow-hidden rounded-[2rem] border border-orange-100 bg-black shadow-sm">
          <Image
            src="/kingdom-business-studies.png"
            alt="Business Studies activity"
            width={1400}
            height={1050}
            priority
            className="h-auto w-full object-contain"
          />
        </section>

        <section className="mb-5 w-full min-w-0 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-orange-50 p-3">
              <BookOpen className="text-orange-500" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-slate-900">
                {reading.title}
              </h2>
              <p className="break-words text-sm text-slate-500">
                Reading Reference: Lesson {lesson.lesson_number}
              </p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {reading.content_text}
          </div>
        </section>

        <section className="mb-5 w-full min-w-0 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-orange-50 p-3">
              <SquarePen className="text-orange-500" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Activity Questions
              </h2>
              {activity.instructions && (
                <p className="text-sm text-slate-500">
                  {activity.instructions}
                </p>
              )}
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No questions are available for this activity.
            </p>
          ) : (
            <div className="w-full min-w-0 space-y-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="w-full min-w-0 rounded-2xl bg-slate-50 p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h3 className="min-w-0 font-bold text-slate-900">
                      Question {question.question_number}
                    </h3>
                    <span className="shrink-0 text-xs font-semibold text-orange-500">
                      {question.marks}{" "}
                      {question.marks === 1 ? "mark" : "marks"}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
                    {question.question_text}
                  </p>
                  {question.assessment_objective && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-orange-500">
                      {question.assessment_objective}
                    </p>
                  )}
                  <textarea
                    disabled={Boolean(submission) || isSubmitting}
                    value={answers[question.id] ?? ""}
                    onChange={(event) => {
                      setAnswers((currentAnswers) => ({
                        ...currentAnswers,
                        [question.id]: event.target.value,
                      }));
                      setSubmissionMessage("");
                    }}
                    placeholder="Type your answer here..."
                    className="mt-3 min-h-[120px] w-full max-w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-orange-300 disabled:bg-slate-100"
                  />
                  {submission?.activity_submission_answers.find(
                    (answer) => answer.question_id === question.id,
                  )?.kingdom_feedback && (() => {
                    const savedAnswer =
                      submission.activity_submission_answers.find(
                        (answer) => answer.question_id === question.id,
                      )!;

                    return (
                      <div className="mt-3 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
                        <p className="font-bold text-orange-600">
                          Kingdom: {savedAnswer.kingdom_mark}/{question.marks}
                        </p>
                        <p className="mt-1">{savedAnswer.kingdom_feedback}</p>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>

        {submission?.status === "awaiting_review" && (
          <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Preliminary Kingdom Assessment
            </h2>
            <p className="mt-4 text-2xl font-bold text-orange-500">
              Preliminary mark: {submission.preliminary_mark}/
              {submission.preliminary_total}
            </p>
            <p className="mt-1 font-semibold text-slate-700">
              Percentage: {submission.preliminary_percentage}%
            </p>
            <p className="mt-3 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800">
              Status: Awaiting Teacher Review
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This result is preliminary and may change after your teacher
              reviews your work.
            </p>
          </section>
        )}

        {submission && submission.status !== "awaiting_review" && (
          <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Activity Submitted
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {submission.status === "marking_failed"
                ? "Your answers are saved. Preliminary marking could not be completed yet."
                : submission.status === "returned"
                  ? "Your teacher has returned this activity. Final-result details will be added in a later step."
                  : "Your answers are saved and preliminary marking is in progress."}
            </p>
          </section>
        )}

        {!submission && (
          <button
            type="button"
            onClick={submitActivity}
            disabled={
              isSubmitting || isLoadingSubmission || submissionAccessBlocked
            }
            className="w-full rounded-2xl bg-orange-500 py-4 text-lg font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Activity"}
          </button>
        )}
        {isLoadingSubmission && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Checking submission status...
          </p>
        )}
        {submissionMessage && (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {submissionMessage}
          </p>
        )}
      </div>
    </main>
  );
}
