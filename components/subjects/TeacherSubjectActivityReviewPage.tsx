import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSearch,
} from "lucide-react";
import {
  getSubjectActivityReviews,
  type TeacherActivityReview,
  type TeacherActivityReviewSubmission,
} from "@/lib/supabase/activityReviewReader";
import {
  buildSubjectDetailRoute,
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

function getDraftMark(submission: TeacherActivityReviewSubmission) {
  return submission.preliminaryMark !== null &&
    submission.preliminaryTotal !== null
    ? `${submission.preliminaryMark}/${submission.preliminaryTotal}`
    : "No draft";
}

function getFinalMark(
  submission: TeacherActivityReviewSubmission,
) {
  return submission.finalMark === null
    ? "Pending"
    : `${submission.finalMark}/${submission.originalTotalMarks}`;
}

function SubmissionRows({
  activity,
  subject,
}: {
  activity: TeacherActivityReview;
  subject: ReturnType<typeof getSubjectConfiguration>;
}) {
  if (activity.submissions.length === 0) {
    return (
      <p className="border-t border-orange-100 p-4 text-sm text-slate-500">
        No learner submissions yet.
      </p>
    );
  }

  return (
    <div className="border-t border-orange-100">
      <div className="hidden grid-cols-[minmax(0,1.5fr)_0.8fr_1fr_1fr_auto] items-center gap-3 bg-orange-50 px-4 py-3 text-xs font-bold text-slate-700 sm:grid">
        <span>Learner</span>
        <span className="text-center">Submission</span>
        <span className="text-center">AI Review Draft</span>
        <span className="text-center">Teacher Final</span>
        <span className="text-center">Review</span>
      </div>

      {activity.submissions.map((submission) => (
        <div key={submission.id}>
          <div className="hidden grid-cols-[minmax(0,1.5fr)_0.8fr_1fr_1fr_auto] items-center gap-3 border-t border-orange-100 px-4 py-4 text-xs sm:grid">
            <p className="min-w-0 break-words font-semibold text-slate-900">
              {submission.learnerName}
            </p>
            <CheckCircle2 className="mx-auto text-green-600" size={20} />
            <p className="text-center font-semibold text-slate-700">
              {getDraftMark(submission)}
            </p>
            <span
              className={`mx-auto rounded-full px-2 py-1 text-center text-[10px] font-semibold ${
                submission.finalMark === null
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {getFinalMark(submission)}
            </span>
            <Link
              href={buildSubjectDetailRoute(
                subject,
                "teacherReview",
                submission.id,
              )}
              className="flex items-center justify-center gap-1 rounded-full bg-orange-500 px-3 py-2 text-[10px] font-semibold text-white"
            >
              <FileSearch size={13} /> Open
            </Link>
          </div>

          <div className="border-t border-orange-100 p-4 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-semibold text-slate-900">
                {submission.learnerName}
              </p>
              <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-green-700">
                <CheckCircle2 size={18} /> Submitted
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-orange-50 p-3">
                <dt className="text-xs font-semibold text-slate-500">
                  AI Review Draft
                </dt>
                <dd className="mt-1 font-bold text-slate-800">
                  {getDraftMark(submission)}
                </dd>
              </div>
              <div className="rounded-2xl bg-orange-50 p-3">
                <dt className="text-xs font-semibold text-slate-500">
                  Teacher Final
                </dt>
                <dd className="mt-1 font-bold text-slate-800">
                  {getFinalMark(submission)}
                </dd>
              </div>
            </dl>
            <Link
              href={buildSubjectDetailRoute(
                subject,
                "teacherReview",
                submission.id,
              )}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-white"
            >
              <FileSearch size={14} /> Open
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export async function TeacherSubjectActivityReviewPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let activities: TeacherActivityReview[] = [];
  let loadError = "";

  try {
    activities = await getSubjectActivityReviews(subject.databaseId);
  } catch (error) {
    console.error(`Unable to load ${subject.displayName} activity reviews:`, error);
    loadError = "Unable to load activity reviews. Please try again.";
  }

  const activityGroups = Object.values(
    activities.reduce<
      Record<
        string,
        { key: string; termNumber: number | null; activities: TeacherActivityReview[] }
      >
    >((groups, activity) => {
      const key = activity.termNumber === null ? "unscheduled" : String(activity.termNumber);

      if (!groups[key]) {
        groups[key] = { key, termNumber: activity.termNumber, activities: [] };
      }

      groups[key].activities.push(activity);
      return groups;
    }, {}),
  );

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
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div
          className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg"
          style={{ height: "240px" }}
        >
          <Image
            src="/hero-banner-2.png"
            alt="Teacher Hero Banner"
            width={1400}
            height={750}
            priority
            className="absolute left-0 top-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 flex h-full flex-col p-5 pt-2">
            <div className="mb-3 flex items-center gap-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark_2.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <div className="mt-auto">
              <Link
                href={buildSubjectRoute(subject, "teacherOverview")}
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>

              <h1 className="text-3xl font-bold text-white">
                Activity Review
              </h1>

              <p className="mt-1 text-sm text-white/90">{subject.displayName}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-orange-50 p-5">
          <h2 className="mb-2 font-bold text-slate-900">Teacher review centre</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Kingdom provides a draft review first. The teacher review is the
            official final mark that will be returned to the learner.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
            {loadError}
          </p>
        ) : activityGroups.length === 0 ? (
          <p className="rounded-[2rem] border border-orange-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
            No published activities available.
          </p>
        ) : (
          <div className="space-y-6">
            {activityGroups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 px-2 text-xl font-bold text-slate-900">
                  {group.termNumber === null
                    ? "Term not set"
                    : `Term ${group.termNumber}`}
                </h2>
                <div className="space-y-4">
                  {group.activities.map((activity) => (
                    <details
                      key={activity.id}
                      className="rounded-[2rem] border border-orange-100 bg-white shadow-sm"
                    >
                      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 p-5 text-left">
                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-bold text-slate-900">
                            {activity.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Total: {activity.totalMarks} marks
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full bg-orange-50 p-2 text-orange-500">
                          <ChevronDown size={20} />
                        </div>
                      </summary>
                      <SubmissionRows
                        activity={activity}
                        subject={subject}
                      />
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black">
          <Link href="/teacher"><div className="py-4">Home</div></Link>
          <Link href="/teacher/subjects"><div className="py-4 text-[#508DB1]">Subjects</div></Link>
          <Link href="/teacher/messages"><div className="py-4">Messages</div></Link>
          <Link href="/teacher/reports"><div className="py-4">Reports</div></Link>
          <Link href="/teacher/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
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

export default function BusinessStudiesActivityReviewPage() {
  return <TeacherSubjectActivityReviewPage />;
}
