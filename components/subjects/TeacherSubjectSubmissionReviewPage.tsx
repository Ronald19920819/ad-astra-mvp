import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import TeacherSubmissionReviewForm from "@/components/activities/TeacherSubmissionReviewForm";
import { StructuredReadingContent } from "@/components/readings/StructuredReadingContent";
import { getSubjectSubmissionReview } from "@/lib/supabase/activityReviewReader";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSubmissionDateKey(submittedAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(submittedAt));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export async function TeacherSubjectSubmissionReviewPage({
  params,
  subjectKey = "business-studies",
}: {
  params: Promise<{ submissionId: string }>;
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const { submissionId } = await params;
  if (!uuidPattern.test(submissionId)) notFound();

  let review;

  try {
    review = await getSubjectSubmissionReview(
      subject.databaseId,
      submissionId,
    );
  } catch (error) {
    console.error(`Unable to load ${subject.displayName} submission review:`, {
      submissionId,
      error,
    });

    return (
      <main
        className="subject-theme min-h-screen bg-slate-100 p-4"
        style={
          {
            "--subject-primary": subject.colourTheme.primary,
            "--subject-soft": subject.colourTheme.softBackground,
            "--subject-border": subject.colourTheme.border,
          } as CSSProperties
        }
      >
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href={buildSubjectRoute(subject, "teacherReview")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} /> Back to Activity Review
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Unable to load submission
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Please try again after confirming the review database migration has
            been applied.
          </p>
        </div>
      </main>
    );
  }

  if (!review) notFound();

  const submittedDate = new Date(review.submittedAt).toLocaleDateString(
    "en-ZA",
    {
      dateStyle: "medium",
      timeZone: "Africa/Johannesburg",
    },
  );
  const submittedTime = new Date(review.submittedAt).toLocaleTimeString(
    "en-ZA",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    },
  );
  const timing = !review.activity.dueDate
    ? { label: "Due date not set", className: "bg-slate-100 text-slate-600" }
    : getSubmissionDateKey(review.submittedAt) > review.activity.dueDate
      ? { label: "Late", className: "bg-red-100 text-red-700" }
      : { label: "On time", className: "bg-green-100 text-green-700" };

  return (
    <main
      className="subject-theme min-h-screen bg-slate-100 pb-24"
      style={
        {
          "--subject-primary": subject.colourTheme.primary,
          "--subject-soft": subject.colourTheme.softBackground,
          "--subject-border": subject.colourTheme.border,
        } as CSSProperties
      }
    >
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href={buildSubjectRoute(subject, "teacherReview")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} /> Back to Activity Review
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="break-words text-3xl font-bold text-slate-900">
                {review.activity.title}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {review.learnerName}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${timing.className}`}
            >
              {timing.label}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={15} /> Submitted {submittedDate} at {submittedTime}
            </span>
            {review.activity.dueDate && (
              <span>
                Due{" "}
                {new Date(`${review.activity.dueDate}T00:00:00Z`).toLocaleDateString(
                  "en-ZA",
                  { dateStyle: "medium", timeZone: "UTC" },
                )}
              </span>
            )}
          </div>
          {review.status === "returned" && (
            <p className="mt-4 rounded-full bg-green-100 px-3 py-2 text-center text-sm font-bold text-green-700">
              Status: Returned
            </p>
          )}
        </section>

        <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-orange-50 p-3">
              <BookOpen className="text-orange-500" size={22} />
            </div>
            <h2 className="break-words text-xl font-bold text-slate-900">
              {review.reading.title}
            </h2>
          </div>
          <div className="max-h-[32rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <StructuredReadingContent content={review.reading.contentText} />
          </div>
        </section>

        <TeacherSubmissionReviewForm
          review={review}
          subjectKey={subjectKey}
        />
      </div>
      <style>{`
        .subject-theme .bg-orange-500 {
          background-color: var(--subject-primary) !important;
        }
        .subject-theme .bg-orange-50 {
          background-color: var(--subject-soft) !important;
        }
        .subject-theme .text-orange-500 {
          color: var(--subject-primary) !important;
        }
        .subject-theme .border-orange-100 {
          border-color: var(--subject-border) !important;
        }
      `}</style>
    </main>
  );
}

export default function BusinessStudiesSubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  return <TeacherSubjectSubmissionReviewPage params={params} />;
}
