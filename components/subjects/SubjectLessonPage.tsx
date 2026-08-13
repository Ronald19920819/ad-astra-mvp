"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerLessonData,
  type LearnerLessonData,
} from "@/lib/supabase/lessonReader";
import { TrackedYouTubePlayer } from "@/components/lessons/TrackedYouTubePlayer";
import { ProtectedReading } from "@/components/learners/ProtectedReading";
import { LESSON_QUIZ_PASS_PERCENT } from "@/lib/lessons/lessonAssessment";
import {
  buildLessonQuizOptionMap,
  type LessonQuizOptionLetter,
} from "@/lib/lessons/lessonQuiz";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import { formatSubjectTeacherLabel } from "@/lib/subjects/subjectTeacherPresentation";

type QuizResult = {
  questionId: string;
  correct: boolean;
  mark: number;
  feedback: string;
};

type MarkingResponse = {
  score: number;
  total: number;
  passed: boolean;
  results: QuizResult[];
  completionToken: string | null;
  completionAvailable: boolean;
  error?: string;
};

const celebrationParticles = [
  { x: -100, y: -72, color: "#F97316" },
  { x: -78, y: -108, color: "#38A169" },
  { x: -48, y: -88, color: "#508DB1" },
  { x: -20, y: -124, color: "#F6C453" },
  { x: 12, y: -96, color: "#F97316" },
  { x: 42, y: -126, color: "#38A169" },
  { x: 70, y: -86, color: "#508DB1" },
  { x: 102, y: -112, color: "#F6C453" },
  { x: -118, y: -42, color: "#F6C453" },
  { x: 116, y: -48, color: "#F97316" },
  { x: -58, y: -142, color: "#38A169" },
  { x: 60, y: -148, color: "#508DB1" },
];

function getYouTubeVideoId(urlValue: string | null) {
  if (!urlValue) return null;

  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") ?? "";
      } else {
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(pathParts[0])) {
          videoId = pathParts[1] ?? "";
        }
      }
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

function formatCompletionDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

export function SubjectLessonPage({
  subjectKey = "business-studies",
  initialLessonData,
  initialLoadError,
  initialTeacherNames,
}: {
  subjectKey?: SubjectKey;
  initialLessonData?: LearnerLessonData | null;
  initialLoadError?: string;
  initialTeacherNames?: string[];
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const themeStyle = {
    "--subject-primary": subject.colourTheme.primary,
    "--subject-soft": subject.colourTheme.softBackground,
    "--subject-border": subject.colourTheme.border,
  } as CSSProperties;
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const hasInitialState =
    initialLessonData !== undefined || initialLoadError !== undefined;
  const [lessonData, setLessonData] = useState<LearnerLessonData | null>(
    initialLessonData ?? null,
  );
  const [isLoading, setIsLoading] = useState(!hasInitialState);
  const [errorMessage, setErrorMessage] = useState(initialLoadError ?? "");
  const [answers, setAnswers] = useState<Record<string, LessonQuizOptionLetter>>({});
  const [submitMessage, setSubmitMessage] = useState("");
  const [isMarking, setIsMarking] = useState(false);
  const [markingResult, setMarkingResult] = useState<MarkingResponse | null>(null);
  const [completionToken, setCompletionToken] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [isCelebrating, setIsCelebrating] = useState(false);
  const teacherLabel = formatSubjectTeacherLabel(initialTeacherNames);

  useEffect(() => {
    if (hasInitialState) {
      return;
    }

    let isActive = true;

    async function loadLesson() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const data = await getLearnerLessonData(lessonId, subject.databaseId);

        if (isActive) {
          setLessonData(data);
          setIsCompleted(Boolean(data?.completion));
          setCompletedAt(data?.completion?.completed_at ?? null);
          setCompletionToken(
            data?.passedQuizAttempt && !data.completion
              ? data.passedQuizAttempt.id
              : null,
          );
        }
      } catch (error) {
        console.error("Unable to load learner lesson:", error);
        if (isActive) {
          setErrorMessage("We could not load this lesson. Please try again.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    if (lessonId) loadLesson();

    return () => {
      isActive = false;
    };
  }, [hasInitialState, lessonId, subject.databaseId]);

  useEffect(() => {
    if (!lessonData?.lesson.id) return;

    void fetch("/api/lessons/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "lesson_view",
        lessonId: lessonData.lesson.id,
      }),
      keepalive: true,
    }).catch((error) => console.error("Unable to save lesson engagement:", error));
  }, [lessonData?.lesson.id]);

  async function submitQuiz() {
    if (!lessonData?.quiz || lessonData.passedQuizAttempt) return;

    const hasMissingAnswer = lessonData.quiz.questions.some(
      (question) => !answers[question.id],
    );

    if (hasMissingAnswer) {
      setSubmitMessage("Please answer every question before submitting.");
      return;
    }

    try {
      setIsMarking(true);
      setSubmitMessage("");

      const response = await fetch("/api/kingdom/mark-lesson-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          answers: lessonData.quiz.questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id],
          })),
        }),
      });
      const result = (await response.json()) as MarkingResponse;

      if (!response.ok) {
        throw new Error(result.error || "This quiz could not be marked.");
      }

      setMarkingResult(result);
      setCompletionToken(result.completionToken);
      const minimumPassingScore = Math.ceil(
        (result.total * LESSON_QUIZ_PASS_PERCENT) / 100,
      );

      setSubmitMessage(
        result.passed
          ? `Excellent work \u2014 you passed with ${result.score}/${result.total}!`
          : `You scored ${result.score}/${result.total}. You need ${minimumPassingScore}/${result.total} to pass.`,
      );
    } catch (error) {
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : "This quiz could not be marked. Please try again.",
      );
    } finally {
      setIsMarking(false);
    }
  }

  function tryAgain() {
    setAnswers({});
    setMarkingResult(null);
    setCompletionToken(null);
    setSubmitMessage("");
  }

  async function completeLesson() {
    if (!completionToken || !markingResult?.passed || isCompleting) return;

    try {
      setIsCompleting(true);
      setCompletionMessage("");
      const response = await fetch("/api/lessons/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, completionToken }),
      });
      const result = (await response.json()) as {
        completed?: boolean;
        completedAt?: string;
        error?: string;
      };

      if (!response.ok || !result.completed) {
        throw new Error(result.error || "The lesson could not be completed.");
      }

      setIsCompleted(true);
      setCompletedAt(result.completedAt ?? new Date().toISOString());
      setCompletionMessage("Lesson complete \u2014 excellent work!");
      setIsCelebrating(true);
      window.setTimeout(() => setIsCelebrating(false), 1100);
    } catch (error) {
      setCompletionMessage(
        error instanceof Error
          ? error.message
          : "The lesson could not be completed. Please try again.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 lg:px-8`} style={themeStyle}>
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-sm text-slate-500 shadow-sm lg:max-w-3xl">
          Loading lesson...
        </div>
      </main>
    );
  }

  if (errorMessage || !lessonData) {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 lg:px-8`} style={themeStyle}>
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:max-w-3xl">
          <Link href={buildSubjectRoute(subject, "learnerClassroom")} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]">
            <ArrowLeft size={16} /> Back to Classroom
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {errorMessage || "Lesson not found"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {!errorMessage && "This lesson may not be available or published yet."}
          </p>
        </div>
      </main>
    );
  }

  const { lesson, video, reading, quiz } = lessonData;
  const videoId = getYouTubeVideoId(video?.content_url ?? null);
  const savedPassedAttempt = lessonData.passedQuizAttempt;
  const quizHasBeenPassed = Boolean(savedPassedAttempt || markingResult?.passed);
  const completedScore =
    savedPassedAttempt?.quiz_score ??
    markingResult?.score ??
    lessonData.completion?.quiz_score ??
    0;
  const completedTotal =
    savedPassedAttempt?.quiz_total ??
    markingResult?.total ??
    quiz?.questions.reduce((total, question) => total + question.marks, 0) ??
    0;
  const completedPercentage =
    completedTotal > 0
      ? Math.round((completedScore / completedTotal) * 100)
      : null;
  const completionDate = completedAt ?? lessonData.completion?.completed_at ?? null;
  const requiredScoreToPass = quiz
    ? Math.ceil((quiz.questions.length * LESSON_QUIZ_PASS_PERCENT) / 100)
    : 0;
  const failedReviewResult = markingResult && !markingResult.passed ? markingResult : null;

  return (
    <main className={`${neueHaas.className} min-h-screen w-full overflow-x-clip bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12 lg:px-8`} style={themeStyle}>
      <div className="mx-auto w-full min-w-0 max-w-md space-y-5 lg:max-w-6xl lg:space-y-8">
        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-6">
          <Link href={buildSubjectRoute(subject, "learnerClassroom")} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]">
            <ArrowLeft size={16} /> Back to Classroom
          </Link>
          <h1 className="break-words text-3xl font-bold text-slate-900">Lesson {lesson.lesson_number}</h1>
          <p className="mt-1 break-words text-lg font-semibold text-slate-700">{lesson.title}</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">Week {lesson.week_number} &middot; Term {lesson.term_number}</p>
          <p className="mt-2 break-words text-sm text-slate-500">{subject.displayName} Lesson Workspace &middot; {teacherLabel}</p>
        </section>

        {video && (
          <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:mx-auto lg:max-w-5xl lg:p-6">
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <div className="rounded-2xl bg-[var(--subject-soft)] p-3"><PlayCircle className="text-[var(--subject-primary)]" size={22} /></div>
              <h2 className="min-w-0 break-words text-xl font-bold text-slate-900">{video.title}</h2>
            </div>
            {videoId ? (
              <TrackedYouTubePlayer
                lessonId={lesson.id}
                materialId={video.id}
                title={video.title}
                videoId={videoId}
              />
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">This video link cannot be embedded right now.</p>
            )}
          </section>
        )}

        {(reading || quiz) && (
          <div
            className={`space-y-5 ${
              reading && quiz
                ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
                : ""
            }`}
          >
            {reading && (
              <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:h-full lg:p-6">
                <div className="mb-4 flex min-w-0 items-center gap-3">
                  <div className="rounded-2xl bg-[var(--subject-soft)] p-3"><BookOpen className="text-[var(--subject-primary)]" size={22} /></div>
                  <h2 className="min-w-0 break-words text-xl font-bold text-slate-900">{reading.title}</h2>
                </div>
                <ProtectedReading content={reading.content_text} scrollable />
              </section>
            )}

            {quiz && (
              <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:h-full lg:p-6">
                <div className="mb-4 flex min-w-0 items-center gap-3">
                  <div className="rounded-2xl bg-[var(--subject-soft)] p-3"><LockKeyhole className="text-[var(--subject-primary)]" size={22} /></div>
                  <h2 className="min-w-0 break-words text-xl font-bold text-slate-900">{quiz.title}</h2>
                </div>
                {savedPassedAttempt ? (
                  <div className="rounded-2xl bg-green-50 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      Saved Quiz Result
                    </p>
                    <p className="mt-1 text-3xl font-bold text-green-700">
                      {savedPassedAttempt.quiz_score}/{savedPassedAttempt.quiz_total}
                    </p>
                    <p className="mt-1 text-sm font-bold text-green-700">
                      Passed
                    </p>
                    <p className="mt-3 rounded-2xl border border-green-100 bg-white p-3 text-sm font-semibold text-green-700">
                      This completed quiz is locked. Another attempt is not required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 lg:max-h-[720px] lg:overflow-y-auto lg:pr-1">
                    {failedReviewResult ? (
                      <>
                        <div className="rounded-2xl bg-orange-50 p-4 text-center">
                          <p className="text-sm font-semibold text-slate-600">Lesson Quiz Result</p>
                          <p className="mt-1 text-3xl font-bold text-orange-600">
                            {failedReviewResult.score}/{failedReviewResult.total}
                          </p>
                          <p className="mt-2 text-sm font-bold text-orange-700">
                            You need {requiredScoreToPass}/{quiz.questions.length} to pass.
                          </p>
                        </div>

                        <div className="space-y-4">
                          {quiz.questions.map((question, index) => {
                            const options = buildLessonQuizOptionMap({
                              optionA: question.option_a,
                              optionB: question.option_b,
                              optionC: question.option_c,
                              optionD: question.option_d,
                            });
                            const selectedAnswer = answers[question.id];
                            const questionResult = failedReviewResult.results.find(
                              (result) => result.questionId === question.id,
                            );

                            return (
                              <div key={question.id} className="w-full min-w-0 rounded-2xl bg-slate-50 p-4">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                  <h3 className="min-w-0 font-bold text-slate-900 font-sans">Question {index + 1} of {quiz.questions.length}</h3>
                                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${questionResult?.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {questionResult?.correct ? "Correct" : "Incorrect"}
                                  </span>
                                </div>
                                <p className="mt-2 break-words font-sans text-sm font-medium leading-6 text-slate-700">{question.question_text}</p>
                                <div className="mt-3 space-y-3">
                                  {(Object.entries(options) as Array<[LessonQuizOptionLetter, string]>).map(([optionLetter, optionText]) => {
                                    const isSelected = selectedAnswer === optionLetter;

                                    return (
                                      <div
                                        key={optionLetter}
                                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left ${
                                          isSelected
                                            ? questionResult?.correct
                                              ? "border-green-200 bg-green-50 text-slate-900"
                                              : "border-red-200 bg-red-50 text-slate-900"
                                            : "border-slate-200 bg-white text-slate-500"
                                        }`}
                                      >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                          isSelected
                                            ? questionResult?.correct
                                              ? "border-green-600 bg-green-600 text-white"
                                              : "border-red-600 bg-red-600 text-white"
                                            : "border-slate-300 bg-white text-slate-500"
                                        }`}>
                                          {optionLetter}
                                        </span>
                                        <div className="min-w-0 space-y-1">
                                          <p className="break-words font-sans text-sm font-medium leading-6">
                                            {optionLetter}. {optionText}
                                          </p>
                                          {isSelected && (
                                            <p className={`text-xs font-bold ${questionResult?.correct ? "text-green-700" : "text-red-700"}`}>
                                              Your answer {questionResult?.correct ? "was correct." : "was incorrect."}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button type="button" onClick={tryAgain} className="w-full rounded-2xl bg-[var(--subject-primary)] py-4 font-bold text-white shadow-sm">
                          Take Again
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-full min-w-0 space-y-4">
                          {quiz.questions.map((question, index) => {
                            const options = buildLessonQuizOptionMap({
                              optionA: question.option_a,
                              optionB: question.option_b,
                              optionC: question.option_c,
                              optionD: question.option_d,
                            });
                            const selectedAnswer = answers[question.id];

                            return (
                              <div key={question.id} className="w-full min-w-0 rounded-2xl bg-slate-50 p-4">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                  <h3 className="min-w-0 font-bold text-slate-900 font-sans">Question {index + 1} of {quiz.questions.length}</h3>
                                  <span className="shrink-0 text-xs font-semibold text-[var(--subject-primary)]">{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>
                                </div>
                                <p className="mt-2 break-words font-sans text-sm font-medium leading-6 text-slate-700">{question.question_text}</p>
                                <div className="mt-3 space-y-3">
                                  {(Object.entries(options) as Array<[LessonQuizOptionLetter, string]>).map(([optionLetter, optionText]) => {
                                    const isSelected = selectedAnswer === optionLetter;

                                    return (
                                      <button
                                        key={optionLetter}
                                        type="button"
                                        disabled={isMarking}
                                        onClick={() => {
                                          setAnswers((current) => ({
                                            ...current,
                                            [question.id]: optionLetter,
                                          }));
                                          setSubmitMessage("");
                                        }}
                                        aria-pressed={isSelected}
                                        aria-label={`Question ${index + 1}, option ${optionLetter}`}
                                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                                          isSelected
                                            ? "border-[var(--subject-primary)] bg-[var(--subject-soft)] text-slate-900 shadow-sm"
                                            : "border-slate-200 bg-white text-slate-900"
                                        } disabled:cursor-not-allowed disabled:opacity-70`}
                                      >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                          isSelected
                                            ? "border-[var(--subject-primary)] bg-[var(--subject-primary)] text-white"
                                            : "border-slate-300 bg-white text-slate-500"
                                        }`}>
                                          {optionLetter}
                                        </span>
                                        <span className="min-w-0 break-words font-sans text-sm font-medium leading-6">
                                          {optionLetter}. {optionText}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {submitMessage && <p className={`rounded-2xl p-3 text-sm font-semibold ${submitMessage.startsWith("Please") || submitMessage.includes("could not") ? "bg-red-50 text-red-700" : "bg-orange-50 text-slate-700"}`}>{submitMessage}</p>}

                        <button disabled={isMarking} type="button" onClick={submitQuiz} className="w-full rounded-2xl bg-[var(--subject-primary)] py-4 font-bold text-white shadow-sm disabled:cursor-wait disabled:opacity-70">
                          {isMarking ? "Marking quiz..." : "Submit Quiz"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {quizHasBeenPassed ? (
              <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-center shadow-sm lg:mx-auto lg:max-w-4xl lg:p-6">
                <Sparkles className="mx-auto text-[var(--subject-primary)]" size={24} />
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {isCompleted ? "Lesson Completed" : "Ready to Complete"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {isCompleted
                    ? "Your progress has been saved."
                    : completionToken
                      ? `Your verified ${LESSON_QUIZ_PASS_PERCENT}% quiz pass has unlocked completion.`
                      : "Learner sign-in must be connected before completion can be saved."}
                </p>
                {isCompleted && (
                  <div className="mt-5 space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-green-50 p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Score
                        </p>
                        <p className="mt-1 font-bold text-green-700">
                          {completedScore}/{completedTotal}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Percentage
                        </p>
                        <p className="mt-1 font-bold text-green-700">
                          {completedPercentage === null
                            ? "Unavailable"
                            : `${completedPercentage}%`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Result
                        </p>
                        <p className="mt-1 font-bold text-green-700">Passed</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Completion date
                        </p>
                        <p className="mt-1 text-sm font-bold text-green-700">
                          {completionDate
                            ? formatCompletionDate(completionDate)
                            : "Unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-green-100 p-4">
                      {video && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                          <CheckCircle2 size={17} /> Video watched
                        </p>
                      )}
                      {reading && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                          <CheckCircle2 size={17} /> Reading completed
                        </p>
                      )}
                      <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                        <CheckCircle2 size={17} /> Quiz passed
                      </p>
                    </div>
                  </div>
                )}
                <div className="relative mt-5">
                  {isCelebrating && celebrationParticles.map((particle, index) => (
                      <span
                        key={index}
                        aria-hidden="true"
                        className="kingdom-particle pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: particle.color,
                          "--particle-x": `${particle.x}px`,
                          "--particle-y": `${particle.y}px`,
                        } as CSSProperties & Record<string, string>}
                      />
                    ))}
                  {!isCompleted && (
                    <button
                      type="button"
                      disabled={!completionToken || isCompleting}
                      onClick={completeLesson}
                      className="kingdom-complete-button w-full rounded-2xl bg-[var(--subject-primary)] py-4 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isCompleting ? "Saving completion..." : "Complete Lesson"}
                    </button>
                  )}
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          buildSubjectRoute(subject, "learnerClassroom"),
                        )
                      }
                      className="w-full rounded-2xl bg-[var(--subject-primary)] py-4 font-bold text-white shadow-sm"
                    >
                      Done
                    </button>
                  )}
                </div>
                {completionMessage && (
                  <p className={`mt-4 rounded-2xl p-3 text-sm font-semibold ${isCompleted ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {completionMessage}
                  </p>
                )}
              </section>
            ) : (
              <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-center shadow-sm lg:mx-auto lg:max-w-4xl lg:p-6">
                <LockKeyhole className="mx-auto text-slate-400" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Achieve at least {LESSON_QUIZ_PASS_PERCENT}% to complete this lesson.
                </p>
              </section>
            )}
      </div>
      <style jsx>{`
        .kingdom-particle {
          animation: kingdom-particle-burst 900ms ease-out forwards;
        }

        .kingdom-complete-button:not(:disabled):active {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 10px 24px rgb(249 115 22 / 35%);
        }

        @keyframes kingdom-particle-burst {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.6);
          }
          to {
            opacity: 0;
            transform: translate(
                calc(-50% + var(--particle-x)),
                calc(-50% + var(--particle-y))
              )
              scale(1.1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kingdom-particle {
            display: none;
          }

          .kingdom-complete-button {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

export default function BusinessStudiesLessonPage() {
  return <SubjectLessonPage />;
}







