import Link from "next/link";
import { Clock } from "lucide-react";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import type { LearnerWorkSummary } from "@/lib/supabase/learnerWorkReader";

// Extracted unmodified from app/your-work/page.tsx so the cross-subject
// Your Work page and the new subject-specific Your Work page render
// identical submission cards from one source, instead of two copies
// drifting apart.
export const fallbackSubjectTheme = {
  primary: "#F97316",
  softBackground: "#FFF3E6",
  border: "#FFEDD5",
} as const;

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  });
}

export function percentage(mark: number | null, total: number | null) {
  if (mark === null || total === null || total <= 0) return null;
  return Math.round((mark / total) * 1000) / 10;
}

export function getSubjectTheme(subjectId: string) {
  return (
    getSubjectConfigurationByDatabaseId(subjectId)?.colourTheme ??
    fallbackSubjectTheme
  );
}

export function scheduleLabel(submission: LearnerWorkSummary) {
  const { termNumber, weekNumber } = submission.lesson;
  if (termNumber === null && weekNumber === null) return "Schedule not set";
  if (termNumber === null) return `Week ${weekNumber}`;
  if (weekNumber === null) return `Term ${termNumber}`;
  return `Term ${termNumber} · Week ${weekNumber}`;
}

export function AwaitingCard({ submission }: { submission: LearnerWorkSummary }) {
  const subjectTheme = getSubjectTheme(submission.subject.id);
  const preliminaryPercentage =
    submission.preliminaryPercentage ??
    percentage(submission.preliminaryMark, submission.preliminaryTotal);
  const hasPreliminaryMark =
    submission.preliminaryMark !== null &&
    submission.preliminaryTotal !== null;

  return (
    <article
      className="min-w-0 rounded-2xl border p-4"
      style={{
        borderColor: subjectTheme.border,
        backgroundColor: `${subjectTheme.softBackground}99`,
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words font-bold text-[#102A43]">
            {submission.activity.title}
          </h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {submission.subject.name} {"·"} {scheduleLabel(submission)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
          Awaiting Review
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock size={14} /> Submitted {formatDate(submission.submittedAt)}
      </p>

      <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-700">
        {submission.status === "marking_failed" ? (
          <p className="font-semibold">Preliminary marking unavailable</p>
        ) : hasPreliminaryMark ? (
          <p>
            <span
              className="font-bold"
              style={{ color: subjectTheme.primary }}
            >
              {submission.preliminaryMark}/{submission.preliminaryTotal}
            </span>
            {preliminaryPercentage !== null && (
              <span className="ml-2 text-xs font-semibold text-slate-500">
                {preliminaryPercentage}% preliminary
              </span>
            )}
          </p>
        ) : (
          <p className="font-semibold">Marking in progress</p>
        )}
      </div>

      <Link
        href={`/your-work/${submission.id}`}
        className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#102A43] px-4 py-3 text-sm font-bold text-white"
      >
        View Submission
      </Link>
    </article>
  );
}

export function ReturnedCard({ submission }: { submission: LearnerWorkSummary }) {
  const subjectTheme = getSubjectTheme(submission.subject.id);
  const finalPercentage = percentage(
    submission.finalMark,
    submission.activity.totalMarks,
  );

  return (
    <article
      className="min-w-0 rounded-2xl border bg-[#FFFDF9] p-4 shadow-sm"
      style={{ borderColor: subjectTheme.border }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words font-bold text-[#102A43]">
            {submission.activity.title}
          </h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {submission.subject.name} {"·"} {scheduleLabel(submission)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
          Returned
        </span>
      </div>

      <div
        className="mt-4 rounded-2xl p-4"
        style={{ backgroundColor: subjectTheme.softBackground }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: subjectTheme.primary }}
        >
          Activity Mark
        </p>
        <p className="mt-1 text-3xl font-bold text-[#102A43]">
          {submission.finalMark ?? "—"}/{submission.activity.totalMarks}
        </p>
        <p
          className="mt-1 text-sm font-bold"
          style={{ color: subjectTheme.primary }}
        >
          {finalPercentage === null
            ? "Percentage unavailable"
            : `Percentage: ${finalPercentage}%`}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          Included in the Activity Performance component of your Overall Mark
        </p>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>Submitted {formatDate(submission.submittedAt)}</p>
        <p>
          Returned {submission.reviewedAt ? formatDate(submission.reviewedAt) : "date unavailable"}
        </p>
        {submission.preliminaryMark !== null &&
          submission.preliminaryTotal !== null && (
            <p>
              Preliminary Kingdom mark: {submission.preliminaryMark}/
              {submission.preliminaryTotal}
            </p>
          )}
      </div>

      <Link
        href={`/your-work/${submission.id}`}
        className="mt-4 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold text-white"
        style={{ backgroundColor: subjectTheme.primary }}
      >
        View Work
      </Link>
    </article>
  );
}
