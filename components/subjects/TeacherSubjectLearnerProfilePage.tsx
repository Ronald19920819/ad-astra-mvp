import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  FileSpreadsheet,
  TriangleAlert,
} from "lucide-react";
import { getSubmissionTiming } from "@/lib/activities/submissionTiming";
import { isDateOverdue } from "@/lib/dates/deadlineStatus";
import { getProfileInitials } from "@/lib/profiles/profileIdentity";
import {
  getSubjectActivityReviews,
  type TeacherActivityReview,
  type TeacherActivityReviewLearner,
  type TeacherActivityReviewMonitorStatus,
} from "@/lib/supabase/activityReviewReader";
import {
  getSubjectLearningTracker,
  type LearningTrackerLearner,
  type TrackerContentState,
  type TrackerLessonStatus,
} from "@/lib/supabase/learningTrackerReader";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import { getLearnerSupportStatus } from "@/lib/teachers/learnerSupport";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LearnerIdentity = {
  firstName: string;
  surname: string;
  displayName: string;
  profileImageUrl: string | null;
};

type LearnerLessonRecord = {
  id: string;
  lessonNumber: string;
  title: string;
  termNumber: number | null;
  weekNumber: number | null;
  displayOrder: number | null;
  learner: LearningTrackerLearner;
};

type LearnerActivityRecord = {
  activity: TeacherActivityReview;
  learner: TeacherActivityReviewLearner;
};

const LESSON_TITLE_SEPARATOR = "\u2014";

function compareProgrammeOrder(
  lessonA: LearnerLessonRecord,
  lessonB: LearnerLessonRecord,
) {
  const termA = lessonA.termNumber ?? Number.MAX_SAFE_INTEGER;
  const termB = lessonB.termNumber ?? Number.MAX_SAFE_INTEGER;
  if (termA !== termB) return termA - termB;

  const weekA = lessonA.weekNumber ?? Number.MAX_SAFE_INTEGER;
  const weekB = lessonB.weekNumber ?? Number.MAX_SAFE_INTEGER;
  if (weekA !== weekB) return weekA - weekB;

  const displayOrderA = lessonA.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const displayOrderB = lessonB.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (displayOrderA !== displayOrderB) return displayOrderA - displayOrderB;

  const lessonNumberDifference = lessonA.lessonNumber.localeCompare(
    lessonB.lessonNumber,
    undefined,
    { numeric: true },
  );
  if (lessonNumberDifference !== 0) return lessonNumberDifference;

  return lessonA.id.localeCompare(lessonB.id);
}

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
}

function formatLastActive(value: Date | null) {
  if (!value) return "Never";
  return value.toLocaleDateString("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  });
}

function formatPercentage(mark: number | null, total: number | null) {
  if (mark === null || total === null || total <= 0) return "\u2014";
  return `${Math.round((mark / total) * 1000) / 10}%`;
}

function progressDisplay(value: TrackerContentState, isOverdue: boolean) {
  if (value === "complete") {
    return { symbol: "\u2713", className: "text-green-600" };
  }

  if (value === "unavailable") {
    return { symbol: "\u2014", className: "text-slate-400" };
  }

  if (isOverdue) {
    return { symbol: "!", className: "text-red-500" };
  }

  return { symbol: "-", className: "text-slate-500" };
}

function lessonStatusLabel(status: TrackerLessonStatus) {
  if (status === "Complete") return "Complete";
  if (status === "Late") return "Complete (Late)";
  if (status === "Incomplete") return "Incomplete";
  return "Attention Required";
}

function lessonStatusBadge(status: TrackerLessonStatus) {
  if (status === "Complete") return "bg-green-100 text-green-700";
  if (status === "Late") return "bg-amber-100 text-amber-700";
  if (status === "Incomplete") return "bg-slate-100 text-slate-600";
  return "bg-red-100 text-red-700";
}

function submissionStatusLabel(status: TeacherActivityReviewMonitorStatus) {
  switch (status) {
    case "submitted":
    case "marking_failed":
      return "Submitted";
    case "awaiting_review":
      return "Awaiting Review";
    case "returned":
      return "Returned";
    case "overdue":
    case "not_submitted":
      return "Not Submitted";
  }
}

function markDisplay(learner: TeacherActivityReviewLearner) {
  const submission = learner.submission;
  if (!submission) return "\u2014";

  if (submission.finalMark !== null) {
    return `${submission.finalMark}/${submission.originalTotalMarks}`;
  }

  if (
    submission.preliminaryMark !== null &&
    submission.preliminaryTotal !== null
  ) {
    return `${submission.preliminaryMark}/${submission.preliminaryTotal} AI Draft`;
  }

  return "\u2014";
}

function percentageDisplay(learner: TeacherActivityReviewLearner) {
  const submission = learner.submission;
  if (!submission) return "\u2014";

  if (submission.finalMark !== null) {
    return formatPercentage(submission.finalMark, submission.originalTotalMarks);
  }

  if (
    submission.preliminaryMark !== null &&
    submission.preliminaryTotal !== null
  ) {
    return formatPercentage(submission.preliminaryMark, submission.preliminaryTotal);
  }

  return "\u2014";
}

function reviewStatusLabel(learner: TeacherActivityReviewLearner) {
  const submission = learner.submission;
  if (!submission) return "\u2014";
  if (submission.finalMark !== null || learner.status === "returned") return "Reviewed";
  if (learner.status === "marking_failed") return "Marking Failed";
  return "Awaiting Review";
}

async function getLearnerIdentity(subjectId: string, learnerProfileId: string) {
  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) throw new Error(authorization.error);
  const supabase = authorization.teacher.admin;

  let { data: enrolment, error: enrolmentError } = await supabase
    .from("learner_subjects")
    .select("learner_profile_id")
    .eq("subject_id", subjectId)
    .eq("learner_profile_id", learnerProfileId)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle();

  if (enrolmentError?.code === "42703" || enrolmentError?.code === "PGRST204") {
    const fallback = await supabase
      .from("learner_subjects")
      .select("learner_profile_id")
      .eq("subject_id", subjectId)
      .eq("learner_profile_id", learnerProfileId)
      .maybeSingle();
    enrolment = fallback.data;
    enrolmentError = fallback.error;
  }

  if (enrolmentError) throw enrolmentError;
  if (!enrolment) return null;

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    .from("learner_profiles")
    .select("id, profile_id, status")
    .eq("id", learnerProfileId)
    .eq("status", "active")
    .maybeSingle();

  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) return null;

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, surname, full_name, profile_image_url")
    .eq("id", learnerProfile.profile_id)
    .eq("role", "learner")
    .maybeSingle();

  if (profileError?.code === "42703" || profileError?.code === "PGRST204") {
    const fallback = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", learnerProfile.profile_id)
      .eq("role", "learner")
      .maybeSingle();
    profile = fallback.data as typeof profile;
    profileError = fallback.error;
  }

  if (profileError) throw profileError;
  if (!profile) return null;

  return {
    firstName:
      "first_name" in profile && typeof profile.first_name === "string"
        ? profile.first_name.trim()
        : "",
    surname:
      "surname" in profile && typeof profile.surname === "string"
        ? profile.surname.trim()
        : "",
    displayName:
      typeof profile.full_name === "string" && profile.full_name.trim()
        ? profile.full_name.trim()
        : "Learner",
    profileImageUrl:
      "profile_image_url" in profile &&
      typeof profile.profile_image_url === "string" &&
      profile.profile_image_url.trim()
        ? profile.profile_image_url.trim()
        : null,
  } satisfies LearnerIdentity;
}

export async function TeacherSubjectLearnerProfilePage({
  params,
  subjectKey,
}: {
  params: Promise<{ learnerId: string }>;
  subjectKey: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const { learnerId } = await params;

  if (!uuidPattern.test(learnerId)) notFound();

  const identity = await getLearnerIdentity(subject.databaseId, learnerId);
  if (!identity) notFound();

  const [lessons, activityReviews] = await Promise.all([
    getSubjectLearningTracker(subject.databaseId),
    getSubjectActivityReviews(subject.databaseId),
  ]);

  const learnerLessons: LearnerLessonRecord[] = lessons.flatMap((lesson) => {
    const learner = lesson.learners.find(
      (candidate) => candidate.learnerProfileId === learnerId,
    );

    return learner
      ? [
          {
            id: lesson.id,
            lessonNumber: lesson.lessonNumber,
            title: lesson.title,
            termNumber: lesson.termNumber,
            weekNumber: lesson.weekNumber,
            displayOrder: lesson.displayOrder,
            learner,
          },
        ]
      : [];
  }).sort(compareProgrammeOrder);

  if (learnerLessons.length === 0) notFound();

  const learnerActivities: LearnerActivityRecord[] = activityReviews.flatMap(
    (activity) => {
      const learner = activity.learners.find(
        (candidate) => candidate.learnerProfileId === learnerId,
      );

      return learner ? [{ activity, learner }] : [];
    },
  );

  const completedLessons = learnerLessons.filter(
    (lesson) =>
      lesson.learner.status === "Complete" || lesson.learner.status === "Late",
  ).length;
  const totalLessons = lessons.length;
  const completedActivities = learnerActivities.filter((record) => {
    const status = record.learner.status;
    return (
      status === "submitted" ||
      status === "marking_failed" ||
      status === "awaiting_review" ||
      status === "returned"
    );
  }).length;
  const totalActivities = activityReviews.length;
  const lastActive = formatLastActive(
    latestTimestamp(learnerLessons.map((lesson) => lesson.learner.lastActiveAt)),
  );
  const overdueItems = learnerLessons.reduce(
    (sum, lesson) => sum + lesson.learner.overdueItemCount,
    0,
  );
  const supportStatus = getLearnerSupportStatus(overdueItems);
  const initials = getProfileInitials(identity, "L");
  const outstandingLessons = learnerLessons.filter(
    (lesson) => lesson.learner.status === "Overdue",
  );
  const outstandingActivities = learnerActivities.filter(
    (record) =>
      !record.learner.submission && isDateOverdue(record.activity.dueDate),
  );

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <section
          className="mb-5 rounded-[2rem] border bg-white p-5 shadow-sm"
          style={{ borderColor: subject.colourTheme.border }}
        >
          <Link
            href={buildSubjectRoute(subject, "teacherLearners")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: subject.colourTheme.primary }}
          >
            <ArrowLeft size={16} />
            Back to Learners
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {identity.profileImageUrl ? (
                <Image
                  src={identity.profileImageUrl}
                  alt={identity.displayName}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-2xl object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ backgroundColor: subject.colourTheme.primary }}
                >
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="break-words text-3xl font-bold text-slate-900">
                  {identity.displayName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{subject.displayName}</p>
              </div>
            </div>

            <span
              className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                supportStatus === "On Track"
                  ? "bg-green-100 text-green-700"
                  : supportStatus === "Needs Support"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {supportStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Lessons Completed</p>
              <p className="mt-1 text-lg font-bold" style={{ color: subject.colourTheme.primary }}>
                {completedLessons} of {totalLessons}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Activities Completed</p>
              <p className="mt-1 text-lg font-bold" style={{ color: subject.colourTheme.primary }}>
                {completedActivities} of {totalActivities}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Last Active</p>
              <p className="mt-1 text-lg font-bold" style={{ color: subject.colourTheme.primary }}>
                {lastActive}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Status</p>
              <p className="mt-1 text-lg font-bold" style={{ color: subject.colourTheme.primary }}>
                {supportStatus}
              </p>
            </div>
          </div>
        </section>

        <section
          className="mb-5 rounded-[2rem] border bg-white p-5 shadow-sm"
          style={{ borderColor: subject.colourTheme.border }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: subject.colourTheme.softBackground,
                color: subject.colourTheme.primary,
              }}
            >
              <TriangleAlert size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Outstanding Work</h2>
              <p className="text-sm text-slate-500">Current overdue work only.</p>
            </div>
          </div>

          {outstandingLessons.length === 0 && outstandingActivities.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No overdue work.
            </p>
          ) : (
            <div className="space-y-3">
              {outstandingLessons.map((lesson) => (
                <div key={`lesson-${lesson.id}`} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Lesson {lesson.lessonNumber} {LESSON_TITLE_SEPARATOR} {lesson.title}
                  </p>
                  <p className="mt-1 text-sm text-red-600">Lesson requires attention.</p>
                </div>
              ))}
              {outstandingActivities.map((record) => (
                <div key={`activity-${record.activity.id}`} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{record.activity.title}</p>
                  <p className="mt-1 text-sm text-red-600">Activity is overdue and not submitted.</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="mb-5 rounded-[2rem] border bg-white p-5 shadow-sm"
          style={{ borderColor: subject.colourTheme.border }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: subject.colourTheme.softBackground,
                color: subject.colourTheme.primary,
              }}
            >
              <BookOpenCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lesson Progress</h2>
              <p className="text-sm text-slate-500">Canonical tracker evidence for each published lesson.</p>
            </div>
          </div>

          <div className="space-y-4">
            {learnerLessons.map((lesson) => {
              const isOverdue = lesson.learner.status === "Overdue";
              const video = progressDisplay(lesson.learner.video, isOverdue);
              const reading = progressDisplay(lesson.learner.reading, isOverdue);
              const quiz = progressDisplay(lesson.learner.quiz, isOverdue);

              return (
                <div key={lesson.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Lesson {lesson.lessonNumber} {LESSON_TITLE_SEPARATOR} {lesson.title}
                      </h3>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${lessonStatusBadge(lesson.learner.status)}`}>
                      {lessonStatusLabel(lesson.learner.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Video</p>
                      <p className={`mt-1 text-lg font-bold ${video.className}`}>{video.symbol}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Reading</p>
                      <p className={`mt-1 text-lg font-bold ${reading.className}`}>{reading.symbol}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Quiz</p>
                      <p className={`mt-1 text-lg font-bold ${quiz.className}`}>{quiz.symbol}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Lesson Status</p>
                      <p className="mt-1 font-bold text-slate-900">{lessonStatusLabel(lesson.learner.status)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-[2rem] border bg-white p-5 shadow-sm"
          style={{ borderColor: subject.colourTheme.border }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: subject.colourTheme.softBackground,
                color: subject.colourTheme.primary,
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Activity Record</h2>
              <p className="text-sm text-slate-500">Published subject activities and current submission history.</p>
            </div>
          </div>

          <div className="space-y-4">
            {learnerActivities.map((record) => {
              const submission = record.learner.submission;
              const timingLabel = submission
                ? getSubmissionTiming(submission.submittedAt, record.activity.dueDate).label
                : isDateOverdue(record.activity.dueDate)
                  ? "Overdue"
                  : "\u2014";

              return (
                <div key={record.activity.id} className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-base font-bold text-slate-900">{record.activity.title}</h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Submission Status</p>
                      <p className="mt-1 font-bold text-slate-900">{submissionStatusLabel(record.learner.status)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Mark</p>
                      <p className="mt-1 font-bold text-slate-900">{markDisplay(record.learner)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Percentage</p>
                      <p className="mt-1 font-bold text-slate-900">{percentageDisplay(record.learner)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Submission Timing</p>
                      <p className="mt-1 font-bold text-slate-900">{timingLabel}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-700">Review Status</p>
                      <p className="mt-1 font-bold text-slate-900">{reviewStatusLabel(record.learner)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}


