import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { ProtectedPdfReading } from "@/components/learners/ProtectedPdfReading";
import { ProtectedReading } from "@/components/learners/ProtectedReading";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  getCurrentLearnerIdentity,
  getLearnerWorkDetail,
} from "@/lib/supabase/learnerWorkReader";

export const dynamic = "force-dynamic";

const fallbackSubjectTheme = {
  primary: "#F97316",
  softBackground: "#FFF3E6",
  border: "#FFEDD5",
} as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

function percentage(mark: number | null, total: number) {
  if (mark === null || total <= 0) return null;
  return Math.round((mark / total) * 1000) / 10;
}

function judgementLabel(value: string | null) {
  if (!value) return null;
  return value.replaceAll("_", " ");
}

export default async function LearnerWorkDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  let identity;

  try {
    identity = await getCurrentLearnerIdentity();
  } catch (error) {
    console.error("Unable to resolve learner identity for submitted work:", {
      submissionId,
      error,
    });
    identity = {
      status: "error" as const,
      message: "Unable to load this submitted activity.",
      code: "IDENTITY_ERROR",
    };
  }

  if (identity.status === "error") {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6 lg:px-8`}
      >
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:max-w-3xl">
          <Link
            href="/your-work"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={17} /> Back to Your Work
          </Link>
          <p className="text-sm font-semibold text-slate-600">
            {identity.message}
          </p>
        </div>
      </main>
    );
  }

  let work;

  try {
    work = await getLearnerWorkDetail(identity.learnerId, submissionId);
  } catch (error) {
    console.error("Unable to load learner submitted work:", {
      submissionId,
      learnerId: identity.learnerId,
      error,
    });

    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6 lg:px-8`}
      >
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm lg:max-w-3xl">
          <Link
            href="/your-work"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={17} /> Back to Your Work
          </Link>
          <p className="text-sm font-semibold text-red-600">
            Unable to load this submitted activity.
          </p>
        </div>
      </main>
    );
  }

  if (!work) notFound();

  const isReturned = work.status === "returned";
  const finalPercentage = percentage(work.finalMark, work.activity.totalMarks);
  const preliminaryPercentage =
    work.preliminaryPercentage ??
    percentage(work.preliminaryMark, work.preliminaryTotal ?? 0);
  const subjectTheme =
    getSubjectConfigurationByDatabaseId(work.subject.id)?.colourTheme ??
    fallbackSubjectTheme;

  return (
    <main
      className={`${neueHaas.className} min-h-screen overflow-x-hidden bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6 lg:px-8`}
    >
      <div className="mx-auto flex w-full max-w-md min-w-0 flex-col gap-5 lg:max-w-6xl lg:gap-8">
        <section className="rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg lg:p-6">
          <Link
            href="/your-work"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-100"
          >
            <ArrowLeft size={17} /> Back to Your Work
          </Link>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold">
                {work.activity.title}
              </h1>
              <p className="mt-1 text-sm text-blue-100">{work.subject.name}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                isReturned
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isReturned ? "Returned" : "Awaiting Teacher Review"}
            </span>
          </div>
          <div className="mt-4 space-y-1 text-xs text-blue-100">
            <p className="flex items-center gap-1.5">
              <Clock size={14} /> Submitted {formatDateTime(work.submittedAt)}
            </p>
            {isReturned && work.reviewedAt && (
              <p>Returned {formatDateTime(work.reviewedAt)}</p>
            )}
          </div>
        </section>

        {identity.isDevelopmentFallback && (
          <p className="mx-auto w-full max-w-md rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 lg:max-w-4xl">
            Development testing mode: showing work for the configured test
            learner.
          </p>
        )}

        {isReturned ? (
          <section
            className="rounded-[2rem] border-2 bg-white p-5 shadow-sm lg:mx-auto lg:w-full lg:max-w-4xl lg:p-6"
            style={{ borderColor: subjectTheme.border }}
          >
            <div className="flex items-center gap-3">
              <div
                className="rounded-2xl p-3"
                style={{
                  backgroundColor: subjectTheme.softBackground,
                  color: subjectTheme.primary,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-[#102A43]">
                Final Teacher Assessment
              </h2>
            </div>
            <p
              className="mt-5 text-xs font-bold uppercase tracking-wide"
              style={{ color: subjectTheme.primary }}
            >
              Activity Mark
            </p>
            <p className="mt-1 text-4xl font-bold text-[#102A43]">
              {work.finalMark ?? "â€”"}/{work.activity.totalMarks}
            </p>
            <p
              className="mt-1 text-lg font-bold"
              style={{ color: subjectTheme.primary }}
            >
              {finalPercentage === null
                ? "Percentage unavailable"
                : `Percentage: ${finalPercentage}%`}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Included in the Activity Performance component of your Overall
              Mark
            </p>
            <div
              className="mt-5 rounded-2xl p-4"
              style={{ backgroundColor: subjectTheme.softBackground }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: subjectTheme.primary }}
              >
                Teacher&apos;s overall comment
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {work.teacherComment?.trim() ||
                  "No overall teacher comment was added."}
              </p>
            </div>
            {work.preliminaryMark !== null &&
              work.preliminaryTotal !== null && (
                <p className="mt-3 text-xs text-slate-500">
                  Preliminary Kingdom mark: {work.preliminaryMark}/
                  {work.preliminaryTotal}
                </p>
              )}
          </section>
        ) : (
          <section
            className="rounded-[2rem] border bg-white p-5 shadow-sm lg:mx-auto lg:w-full lg:max-w-4xl lg:p-6"
            style={{ borderColor: subjectTheme.border }}
          >
            <div className="flex items-center gap-3">
              <div
                className="rounded-2xl p-3"
                style={{
                  backgroundColor: subjectTheme.softBackground,
                  color: subjectTheme.primary,
                }}
              >
                <Sparkles size={24} />
              </div>
              <h2 className="text-xl font-bold text-[#102A43]">
                Preliminary Kingdom Assessment
              </h2>
            </div>
            {work.preliminaryMark !== null &&
            work.preliminaryTotal !== null ? (
              <>
                <p className="mt-5 text-3xl font-bold text-[#102A43]">
                  {work.preliminaryMark}/{work.preliminaryTotal}
                </p>
                <p
                  className="mt-1 font-bold"
                  style={{ color: subjectTheme.primary }}
                >
                  {preliminaryPercentage === null
                    ? "Percentage unavailable"
                    : `${preliminaryPercentage}%`}
                </p>
              </>
            ) : (
              <p className="mt-5 font-semibold text-slate-600">
                {work.status === "marking_failed"
                  ? "Preliminary marking unavailable"
                  : "Marking in progress"}
              </p>
            )}
            <p className="mt-4 rounded-full bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-800">
              Awaiting Teacher Review
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This result is preliminary and may change after your teacher
              reviews your work.
            </p>
          </section>
        )}

        <section className="min-w-0 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:mx-auto lg:w-full lg:max-w-3xl lg:p-6">
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <div
              className="shrink-0 rounded-2xl p-3"
              style={{
                backgroundColor: subjectTheme.softBackground,
                color: subjectTheme.primary,
              }}
            >
              <BookOpen size={22} />
            </div>
            <h2 className="min-w-0 break-words text-xl font-bold text-[#102A43]">
              {work.reading.title}
            </h2>
          </div>
          {work.reading.sourceType === "pdf" ? (
            <ProtectedPdfReading
              sourceUrl={`/api/activity-submissions/${encodeURIComponent(work.id)}/reading-pdf`}
            />
          ) : (
            <ProtectedReading content={work.reading.contentText} />
          )}
        </section>

        <section className="space-y-4 lg:mx-auto lg:w-full lg:max-w-4xl">
          {work.questions.map((question) => (
            <article
              key={question.id}
              className="min-w-0 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:p-6"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h2 className="min-w-0 font-bold text-[#102A43]">
                  Question {question.questionNumber}
                </h2>
                <span
                  className="shrink-0 text-xs font-bold"
                  style={{ color: subjectTheme.primary }}
                >
                  {question.maximumMarks} marks
                </span>
              </div>
              <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
                {question.questionText}
              </p>
              {question.assessmentObjective && (
                <p
                  className="mt-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: subjectTheme.primary }}
                >
                  {question.assessmentObjective}
                </p>
              )}

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Your Answer</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {question.answer.answerText}
                </p>
              </div>

              <div
                className="mt-4 rounded-2xl border p-4"
                style={{
                  borderColor: subjectTheme.border,
                  backgroundColor: subjectTheme.softBackground,
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: subjectTheme.primary }}
                >
                  Kingdom Preliminary Assessment
                </p>
                <p className="mt-2 font-bold text-[#102A43]">
                  {question.answer.kingdomMark === null
                    ? "Mark unavailable"
                    : `${question.answer.kingdomMark}/${question.maximumMarks}`}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {question.answer.kingdomFeedback ??
                    "No preliminary feedback is available."}
                </p>
                {judgementLabel(question.answer.kingdomJudgement) && (
                  <p
                    className="mt-2 text-xs font-bold capitalize"
                    style={{ color: subjectTheme.primary }}
                  >
                    {judgementLabel(question.answer.kingdomJudgement)}
                  </p>
                )}
              </div>

              {isReturned && (
                <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-[#EEF7FF] p-4">
                  <p className="text-sm font-bold text-[#102A43]">
                    Final Teacher Assessment
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#102A43]">
                    {question.answer.teacherMark === null
                      ? "â€”"
                      : question.answer.teacherMark}
                    /{question.maximumMarks}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                    {question.answer.teacherFeedback?.trim() ||
                      "No question-specific teacher feedback was added."}
                  </p>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
