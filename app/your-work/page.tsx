import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  getCurrentLearnerIdentity,
  getLearnerWorkOverview,
  type LearnerWorkSummary,
} from "@/lib/supabase/learnerWorkReader";

export const dynamic = "force-dynamic";

const fallbackSubjectTheme = {
  primary: "#F97316",
  softBackground: "#FFF3E6",
  border: "#FFEDD5",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  });
}

function percentage(mark: number | null, total: number | null) {
  if (mark === null || total === null || total <= 0) return null;
  return Math.round((mark / total) * 1000) / 10;
}

function getSubjectTheme(subjectId: string) {
  return (
    getSubjectConfigurationByDatabaseId(subjectId)?.colourTheme ??
    fallbackSubjectTheme
  );
}

function scheduleLabel(submission: LearnerWorkSummary) {
  const { termNumber, weekNumber } = submission.lesson;
  if (termNumber === null && weekNumber === null) return "Schedule not set";
  if (termNumber === null) return `Week ${weekNumber}`;
  if (weekNumber === null) return `Term ${termNumber}`;
  return `Term ${termNumber} · Week ${weekNumber}`;
}

type WorkGroup = {
  subjectId: string;
  subjectName: string;
  terms: {
    key: string;
    termNumber: number | null;
    submissions: LearnerWorkSummary[];
  }[];
};

function groupWork(submissions: LearnerWorkSummary[]): WorkGroup[] {
  const subjects = new Map<
    string,
    {
      subjectName: string;
      terms: Map<number | null, LearnerWorkSummary[]>;
    }
  >();

  for (const submission of submissions) {
    const subject = subjects.get(submission.subject.id) ?? {
      subjectName: submission.subject.name,
      terms: new Map<number | null, LearnerWorkSummary[]>(),
    };
    const termSubmissions =
      subject.terms.get(submission.lesson.termNumber) ?? [];
    termSubmissions.push(submission);
    subject.terms.set(submission.lesson.termNumber, termSubmissions);
    subjects.set(submission.subject.id, subject);
  }

  return [...subjects.entries()]
    .map(([subjectId, subject]) => ({
      subjectId,
      subjectName: subject.subjectName,
      terms: [...subject.terms.entries()]
        .map(([termNumber, termSubmissions]) => ({
          key: termNumber === null ? "unscheduled" : String(termNumber),
          termNumber,
          submissions: termSubmissions,
        }))
        .sort((a, b) => {
          if (a.termNumber === null) return 1;
          if (b.termNumber === null) return -1;
          return b.termNumber - a.termNumber;
        }),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

function AwaitingCard({ submission }: { submission: LearnerWorkSummary }) {
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
            {submission.subject.name} · {scheduleLabel(submission)}
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

function ReturnedCard({ submission }: { submission: LearnerWorkSummary }) {
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
            {submission.subject.name} · {scheduleLabel(submission)}
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

function WorkSection({
  title,
  icon,
  submissions,
  emptyMessage,
  returned,
}: {
  title: string;
  icon: React.ReactNode;
  submissions: LearnerWorkSummary[];
  emptyMessage: string;
  returned: boolean;
}) {
  const groups = groupWork(submissions);

  return (
    <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[#FFF3E6] p-3 text-orange-500">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-[#102A43]">{title}</h2>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((subject) => (
            <div key={subject.subjectId}>
              <h3
                className="mb-3 text-sm font-bold"
                style={{ color: getSubjectTheme(subject.subjectId).primary }}
              >
                {subject.subjectName}
              </h3>
              <div className="space-y-4">
                {subject.terms.map((term) => (
                  <div key={term.key}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {term.termNumber === null
                        ? "Term not set"
                        : `Term ${term.termNumber}`}
                    </p>
                    <div className="space-y-3">
                      {term.submissions.map((submission) =>
                        returned ? (
                          <ReturnedCard
                            key={submission.id}
                            submission={submission}
                          />
                        ) : (
                          <AwaitingCard
                            key={submission.id}
                            submission={submission}
                          />
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function YourWorkPage() {
  let identity;

  try {
    identity = await getCurrentLearnerIdentity();
  } catch (error) {
    console.error("Unable to resolve learner identity for Your Work:", error);
    identity = {
      status: "error" as const,
      message: "Unable to load your work.",
      code: "IDENTITY_ERROR",
    };
  }

  let submissions: LearnerWorkSummary[] = [];
  let loadError = "";

  if (identity.status === "success") {
    try {
      submissions = await getLearnerWorkOverview(identity.learnerId);
    } catch (error) {
      console.error("Unable to load learner work overview:", error);
      loadError = "Unable to load your work.";
    }
  }

  const awaiting = submissions.filter(
    (submission) => submission.status !== "returned",
  );
  const returned = submissions.filter(
    (submission) => submission.status === "returned",
  );
  const learnerFirstName =
    identity.status === "success"
      ? identity.fullName?.trim().split(/\s+/)[0] ?? ""
      : "";
  const heading = learnerFirstName
    ? `Here’s your work, ${learnerFirstName}`
    : "Here’s your work";

  return (
    <main
      className={`${neueHaas.className} min-h-screen overflow-x-hidden bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6`}
    >
      <div className="mx-auto w-full max-w-md min-w-0">
        <section className="mb-5 rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg">
          <Link
            href="/home"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-100"
          >
            <ArrowLeft size={17} /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3 text-orange-400">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{heading}</h1>
              <p className="mt-1 text-sm text-blue-100">
                Review your submitted activities, teacher feedback and final
                marks.
              </p>
            </div>
          </div>
        </section>

        {identity.status === "error" ? (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
            {identity.message}
          </section>
        ) : loadError ? (
          <section className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
            {loadError}
          </section>
        ) : submissions.length === 0 ? (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
            No submitted work yet.
          </section>
        ) : (
          <>
            {identity.isDevelopmentFallback && (
              <p className="mb-5 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                Development testing mode: showing work for the configured test
                learner.
              </p>
            )}
            <WorkSection
              title="Awaiting Teacher Review"
              icon={<Sparkles size={22} />}
              submissions={awaiting}
              emptyMessage="No work is currently awaiting review."
              returned={false}
            />
            <WorkSection
              title="Returned Work"
              icon={<CheckCircle2 size={22} />}
              submissions={returned}
              emptyMessage="No work has been returned yet."
              returned
            />
          </>
        )}
      </div>
    </main>
  );
}
