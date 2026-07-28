"use client";
import ActivityQuestionBuilder, {
  type ActivityQuestion,
} from "@/components/activities/ActivityQuestionBuilder";
import { publishActivityToSupabase } from "@/lib/supabase/activityPublisher";
import { TeacherApiError } from "@/lib/supabase/teacherApiClient";
import {
  getTeacherActivityEditorData,
  getTeacherPublishedActivities,
  type TeacherPublishedActivity,
} from "@/lib/supabase/activityReader";
import {
  getLearnerPublishedLessons,
  type PublishedLesson,
} from "@/lib/supabase/lessonReader";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import { subjectQuestionPresets } from "@/lib/subjects/questionPresets";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Plus,
  Rocket,
  Shield,
  Trash2,
} from "lucide-react";

function createBlankActivityQuestion(
  subjectKey: SubjectKey = "business-studies",
): ActivityQuestion {
  return {
    id: 1,
    paper: subjectQuestionPresets[subjectKey].papers[0].value,
    questionType: "",
    questionText: "",
    marks: "",
    ao: "",
    guidance: "",
    isGenerating: false,
    hasGeneratedQuestion: false,
  };
}

export function TeacherSubjectActivitiesPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const subjectId = subject.databaseId;
  const [activityQuestions, setActivityQuestions] =
  useState<ActivityQuestion[]>([createBlankActivityQuestion(subjectKey)]);
  const [isAskingKingdom, setIsAskingKingdom] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityInstructions, setActivityInstructions] = useState(
    "Complete all questions. Answer in full sentences.",
  );
  const [linkedLesson, setLinkedLesson] = useState("");
  const [marks, setMarks] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [activities, setActivities] = useState<TeacherPublishedActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [publishedLessons, setPublishedLessons] = useState<PublishedLesson[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [lessonsError, setLessonsError] = useState("");
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(
    null,
  );
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    null,
  );
  const [editingSubmissionCount, setEditingSubmissionCount] = useState(0);
  const [confirmedSubmissionImpact, setConfirmedSubmissionImpact] =
    useState(false);
  const [pendingEditActivity, setPendingEditActivity] =
    useState<TeacherPublishedActivity | null>(null);
  const [confirmBeforeSave, setConfirmBeforeSave] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
useEffect(() => {
  async function loadPublishedActivities() {
    try {
      setIsLoadingActivities(true);
      setActivitiesError("");

      const publishedActivities = await getTeacherPublishedActivities(
        subjectId,
      );

      setActivities(publishedActivities);
    } catch (error) {
      console.error("Load published activities error:", error);

      setActivitiesError(
        error instanceof Error
          ? error.message
          : "Published activities could not be loaded."
      );
    } finally {
      setIsLoadingActivities(false);
    }
  }

  loadPublishedActivities();
}, [subjectId]);

useEffect(() => {
  async function loadPublishedLessons() {
    try {
      setIsLoadingLessons(true);
      setLessonsError("");

      const lessons = await getLearnerPublishedLessons(
        subjectId,
      );
      const orderedLessons = [...lessons].sort((lessonA, lessonB) => {
        if (lessonA.term_number !== lessonB.term_number) {
          return (lessonB.term_number ?? Number.NEGATIVE_INFINITY) -
            (lessonA.term_number ?? Number.NEGATIVE_INFINITY);
        }

        if (lessonA.week_number !== lessonB.week_number) {
          return (lessonB.week_number ?? Number.NEGATIVE_INFINITY) -
            (lessonA.week_number ?? Number.NEGATIVE_INFINITY);
        }

        const lessonNumberOrder = lessonA.lesson_number.localeCompare(
          lessonB.lesson_number,
          undefined,
          { numeric: true },
        );

        return lessonNumberOrder || lessonA.title.localeCompare(lessonB.title);
      });

      setPublishedLessons(orderedLessons);
    } catch (error) {
      console.error(`Load published ${subject.displayName} lessons error:`, error);
      setLessonsError(
        "Published lessons could not be loaded. Please try again.",
      );
    } finally {
      setIsLoadingLessons(false);
    }
  }

  loadPublishedLessons();
}, [subject.displayName, subjectId]);

const handleDeleteActivity = async (activity: TeacherPublishedActivity) => {
  if (deletingActivityId) return;

  const confirmed = window.confirm(
    `Delete "${activity.title}"?\n\nThis will permanently remove the activity and its questions. This cannot be undone.`,
  );

  if (!confirmed) return;

  try {
    setDeletingActivityId(activity.id);
    const response = await fetch(
      `/api/teacher/business-studies/activities/${activity.id}?subjectId=${encodeURIComponent(subjectId)}`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      throw new Error(result.error || "The activity could not be deleted.");
    }

    setActivities((currentActivities) =>
      currentActivities.filter(
        (currentActivity) => currentActivity.id !== activity.id,
      ),
    );
    alert(`"${activity.title}" was deleted successfully.`);
  } catch (error) {
    console.error("Delete published activity error:", error);
    alert(
      error instanceof Error
        ? error.message
        : "The activity could not be deleted. Please try again.",
    );
  } finally {
    setDeletingActivityId(null);
  }
};

const openActivityEditor = async (
  activity: TeacherPublishedActivity,
  confirmed: boolean,
) => {
  try {
    setIsLoadingActivity(true);
    const editorData = await getTeacherActivityEditorData(
      activity.id,
      subjectId,
    );
    const editorQuestions: ActivityQuestion[] = editorData.questions.map(
      (question, index) => ({
        id: index + 1,
        databaseId: question.id,
        paper:
          question.paper ??
          subjectQuestionPresets[subjectKey].papers[0].value,
        questionType: question.question_type ?? "",
        questionText: question.question_text,
        marks: String(question.marks),
        ao: question.assessment_objective ?? "",
        guidance: question.guidance ?? "",
        isGenerating: false,
        hasGeneratedQuestion: true,
      }),
    );

    setEditingActivityId(editorData.activity.id);
    setEditingSubmissionCount(activity.submissionCount);
    setConfirmedSubmissionImpact(confirmed);
    setActivityTitle(editorData.activity.title);
    setActivityInstructions(editorData.activity.instructions);
    setLinkedLesson(editorData.activity.lessonId);
    setDueDate(editorData.activity.due_date?.slice(0, 10) ?? "");
    setActivityQuestions(editorQuestions);
    document.getElementById("activity-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Open published activity error:", error);
    alert("The activity could not be opened for editing.");
  } finally {
    setIsLoadingActivity(false);
  }
};

const handleEditActivity = (activity: TeacherPublishedActivity) => {
  if (activity.submissionCount > 0) {
    setPendingEditActivity(activity);
    return;
  }

  void openActivityEditor(activity, false);
};

  const publishActivity = async (confirmationOverride = false) => {
  if (!activityTitle.trim()) {
    alert("Enter an activity title.");
    return;
  }

  if (!linkedLesson) {
    alert("Select a linked lesson.");
    return;
  }

  if (!activityInstructions.trim()) {
    alert("Enter activity instructions.");
    return;
  }

  if (activityQuestions.length === 0) {
    alert("Add at least one question.");
    return;
  }

  const hasIncompleteQuestion = activityQuestions.some(
    (question) =>
      !question.questionType ||
      !question.questionText.trim() ||
      !question.marks
  );

  if (hasIncompleteQuestion) {
    alert("Complete the question type and question text for every question.");
    return;
  }

  try {
    setIsPublishing(true);

    await publishActivityToSupabase({
  subjectId,
  activityId: editingActivityId ?? undefined,
  confirmedSubmissionImpact:
    confirmedSubmissionImpact || confirmationOverride,
  title: activityTitle.trim(),
  instructions: activityInstructions.trim(),
  lessonId: linkedLesson,
  totalMarks: Number(marks),
  dueDate,
  questions: activityQuestions,
});

    const refreshedActivities = await getTeacherPublishedActivities(
      subjectId,
    );

setActivities(refreshedActivities);

    setActivityTitle("");
    setActivityInstructions(
      "Complete all questions. Answer in full sentences.",
    );
    setLinkedLesson("");
    setDueDate("");
    setEditingActivityId(null);
    setEditingSubmissionCount(0);
    setConfirmedSubmissionImpact(false);
    setActivityQuestions([createBlankActivityQuestion(subjectKey)]);

    alert(
      editingActivityId
        ? "Activity changes saved successfully."
        : "Activity published successfully.",
    );
    document.getElementById("activity-library")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Publish activity error:", error);

    if (
      error instanceof TeacherApiError &&
      error.code === "CONFIRM_SUBMISSION_IMPACT"
    ) {
      setConfirmBeforeSave(true);
      return;
    }

    alert(
      error instanceof Error
        ? error.message
        : "The activity could not be published."
    );
  } finally {
    setIsPublishing(false);
  }
};
const askKingdom = async () => {
  try {
    setIsAskingKingdom(true);

    const response = await fetch("/api/kingdom/generate-activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subjectKey,
        linkedLesson,
  activityTitle,
  questions: activityQuestions,
}),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Kingdom could not process the activity.");
      return;
    }

    setActivityQuestions((currentQuestions) =>
      currentQuestions.map((currentQuestion) => {
        const generatedQuestion = data.questions.find(
          (question: { id: number; questionText: string }) =>
            question.id === currentQuestion.id,
        );
        return generatedQuestion
          ? {
              ...currentQuestion,
              questionText: generatedQuestion.questionText,
            }
          : currentQuestion;
      }),
    );
    alert("Kingdom has drafted the activity questions.");
  } catch (error) {
    console.error(error);
    alert("Unable to contact Kingdom.");
  } finally {
    setIsAskingKingdom(false);
  }
};
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
      <div className="mx-auto max-w-md px-4 pt-3">
        {/* Hero Banner */}
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

          <div className="relative z-10 h-full p-5 flex flex-col pt-2">
            <div className="flex items-center gap-3 mb-3">
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
                Activity Centre
              </h1>

              <p className="mt-1 text-sm text-white/90">
                {subject.displayName} Faculty
              </p>
            </div>
          </div>
        </div>

        {/* Create Activity */}
        <div
          id="activity-editor"
          className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <Plus className="text-orange-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {editingActivityId ? "Edit Activity" : "Create Activity"}
              </h2>
              <p className="text-sm text-slate-500">
                Attach learner work to a published lesson
              </p>
            </div>
          </div>

          {editingActivityId && editingSubmissionCount > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-900">
                {editingSubmissionCount} learner{" "}
                {editingSubmissionCount === 1
                  ? "submission exists"
                  : "submissions exist"}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-800">
                Editing affects future submissions only.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <input
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="Activity Title"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />

            <textarea
              value={activityInstructions}
              onChange={(event) => setActivityInstructions(event.target.value)}
              placeholder="Activity instructions"
              rows={3}
              className="w-full resize-y rounded-2xl border border-slate-200 p-3 outline-none"
            />

            <select
  value={linkedLesson}
  onChange={(e) => setLinkedLesson(e.target.value)}
  disabled={isLoadingLessons}
  className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
>
  <option value="">
    {isLoadingLessons
      ? "Loading lessons..."
      : publishedLessons.length === 0
        ? "No published lessons available"
        : "Select Linked Lesson"}
  </option>
  {publishedLessons.map((lesson) => (
    <option key={lesson.id} value={lesson.id}>
      Lesson {lesson.lesson_number} — {lesson.title} · Term{" "}
      {lesson.term_number} · Week {lesson.week_number}
    </option>
  ))}
</select>

            {lessonsError && (
              <p className="text-sm font-semibold text-red-600">
                {lessonsError}
              </p>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
  <span className="text-sm font-semibold text-slate-600">
    Total Marks
  </span>

  <span className="font-bold text-slate-900">
    {marks}
  </span>
</div>

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="Due Date"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />
          </div>

  
<ActivityQuestionBuilder
  subjectKey={subjectKey}
  questions={activityQuestions}
  setQuestions={setActivityQuestions}
  onTotalMarksChange={(total) => setMarks(String(total))}
/>

<button
  type="button"
  onClick={askKingdom}
disabled={isAskingKingdom}
  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e8b017] py-3 font-semibold text-white hover:brightness-95"
>
  <Shield size={18} />
  {isAskingKingdom ? "Kingdom is thinking..." : "Ask Kingdom"}
</button>

<button
  type="button"
  onClick={() => void publishActivity()}
  disabled={isPublishing}
  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
>
  {editingActivityId ? <Pencil size={18} /> : <Rocket size={18} />}

  {isPublishing
    ? editingActivityId
      ? "Saving..."
      : "Publishing..."
    : editingActivityId
      ? "Save Changes"
      : "Publish Activity"}
</button>
        </div>

        {/* Published Activities */}
        <div
          id="activity-library"
          className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <FileText className="text-orange-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Published Activities
              </h2>
              <p className="text-sm text-slate-500">
                Activities available to learners
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoadingActivities ? (
              <p className="text-sm text-slate-500">
                Loading published activities...
              </p>
            ) : activitiesError ? (
              <p className="text-sm font-semibold text-red-600">
                {activitiesError}
              </p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-500">
                No published activities yet.
              </p>
            ) : activities.map((activity) => (
              <div
  key={activity.id}
  className="rounded-2xl border border-orange-100 p-4"
>
  <div className="mb-2 flex items-center justify-between gap-3">
    <h3 className="font-semibold text-slate-900">
      {activity.title}
    </h3>

    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
      Published
    </span>
  </div>

  <p className="text-sm text-slate-500">
    Lesson material: {activity.lesson_material_id} •{" "}
    {activity.total_marks} marks • Due:{" "}
    {activity.due_date
      ? new Date(activity.due_date).toLocaleDateString("en-ZA")
      : "No due date"}
  </p>

  <div className="mt-3 flex items-center gap-2">
    <button
      type="button"
      onClick={() => handleEditActivity(activity)}
      disabled={isLoadingActivity}
      className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
      aria-label={`Edit ${activity.title}`}
      title="Edit activity"
    >
      <Pencil size={15} />
      Edit
    </button>

    <button
      type="button"
      onClick={() => handleDeleteActivity(activity)}
      disabled={deletingActivityId !== null}
      className="inline-flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Delete activity"
      title="Delete activity"
    >
      <Trash2 size={15} />
    </button>
  </div>

  {activity.submissionCount > 0 && (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-bold text-amber-900">
        {activity.submissionCount} learner{" "}
        {activity.submissionCount === 1 ? "submission" : "submissions"}
      </p>
      <p className="mt-1 text-xs font-semibold text-amber-800">
        Editing affects future submissions only.
      </p>
    </div>
  )}
</div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4 text-[#508DB1]">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
      {(pendingEditActivity || confirmBeforeSave) && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-submission-warning-title"
            className="w-full max-w-md rounded-[2rem] border border-orange-100 bg-white p-5 shadow-xl"
          >
            <h2
              id="activity-submission-warning-title"
              className="text-xl font-bold text-slate-900"
            >
              This activity already has learner submissions.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Changes will apply only to learners who have not yet submitted.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Existing submissions, answers, marks and feedback will remain
              unchanged. Learners who have already submitted will not be asked
              to complete the activity again.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingEditActivity(null);
                  setConfirmBeforeSave(false);
                }}
                className="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const activity = pendingEditActivity;
                  setPendingEditActivity(null);
                  setConfirmBeforeSave(false);
                  setConfirmedSubmissionImpact(true);

                  if (activity) {
                    void openActivityEditor(activity, true);
                  } else {
                    void publishActivity(true);
                  }
                }}
                className="rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white"
              >
                Continue Editing
              </button>
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .subject-theme .bg-orange-500 {
          background-color: var(--subject-primary) !important;
        }
        .subject-theme .bg-orange-50,
        .subject-theme .bg-orange-100 {
          background-color: var(--subject-soft) !important;
        }
        .subject-theme .text-orange-500,
        .subject-theme .text-orange-600,
        .subject-theme .text-orange-700 {
          color: var(--subject-primary) !important;
        }
        .subject-theme .border-orange-100,
        .subject-theme .border-orange-200 {
          border-color: var(--subject-border) !important;
        }
      `}</style>
    </main>
  );
}

export default function BusinessStudiesActivitiesPage() {
  return <TeacherSubjectActivitiesPage />;
}
