"use client";
import { updateLessonStatus } from "@/lib/supabase/lessonStatusUpdater";
import { publishLesson } from "@/lib/supabase/lessonPublisher";
import { publishLessonMaterial } from "@/lib/supabase/lessonMaterialPublisher";
import { publishLessonQuiz } from "@/lib/supabase/lessonQuizPublisher";
import { deleteDraftLesson } from "@/lib/supabase/lessonDeleter";
import {
  getTeacherPublishedLessons,
  type PublishedLesson,
} from "@/lib/supabase/lessonReader";
import {
  getLessonEditorData,
} from "@/lib/supabase/lessonEditorReader";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronRight,
  Rocket,
  Video,
  Shield,
  Trash2,
  X,
} from "lucide-react";

type LessonQuizQuestion = {
  id: number;
  questionText: string;
  answerText: string;
  marks: 1;
};

export default function BusinessStudiesClassroomPage() {
  const [lessonNumber, setLessonNumber] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [termNumber, setTermNumber] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [readingTitle, setReadingTitle] = useState("");
  const [readingText, setReadingText] = useState("");
  const [quizQuestions, setQuizQuestions] =
  useState<LessonQuizQuestion[]>([]);
  const [currentLessonId, setCurrentLessonId] =
  useState<string | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] =
  useState(false);
  const [isAskingKingdom, setIsAskingKingdom] = useState(false);
  const askKingdomForQuiz = async () => {
  if (!readingTitle.trim() || !readingText.trim()) {
    alert("Add and save a reading before asking Kingdom.");
    return;
  }

  try {
    setIsAskingKingdom(true);

    const response = await fetch("/api/kingdom/generate-lesson-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        readingTitle: readingTitle.trim(),
        readingText: readingText.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Kingdom could not generate the lesson quiz.");
      return;
    }

    setQuizQuestions(data.questions);
  } catch (error) {
    console.error("Kingdom lesson quiz error:", error);
    alert("Unable to contact Kingdom.");
  } finally {
    setIsAskingKingdom(false);
  }
};
  const [activeContentPanel, setActiveContentPanel] = useState<
  "video" | "reading" | "quiz" | null
>(null);
const hasVideo =
  videoTitle.trim().length > 0 &&
  videoUrl.trim().length > 0;

const hasReading =
  readingTitle.trim().length > 0 &&
  readingText.trim().length > 0;

const hasQuiz = quizQuestions.length > 0;

const hasCoursework = hasVideo || hasReading;
  const [lessons, setLessons] = useState<PublishedLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [openTerm, setOpenTerm] = useState<number | null>(null);
  const [deletingPublishedLessonId, setDeletingPublishedLessonId] = useState<
    string | null
  >(null);
  const businessStudiesSubjectId =
  "c472f3c9-0e6f-40de-a748-3ad9400ac069";
const ensureDraftLesson = async () => {
  if (currentLessonId) {
    return currentLessonId;
  }

  if (
    !lessonNumber.trim() ||
    !lessonTitle.trim() ||
    !termNumber ||
    !weekNumber
  ) {
    throw new Error(
      "Complete the lesson details before adding lesson content."
    );
  }

  const createdLesson = await publishLesson({
    subjectId: businessStudiesSubjectId,
    lessonNumber: lessonNumber.trim(),
    title: lessonTitle.trim(),
    termNumber: Number(termNumber),
    weekNumber: Number(weekNumber),
    status: "draft",
  });

  setCurrentLessonId(createdLesson.id);

  await loadLessons();

  return createdLesson.id;
};
  const loadLessons = async () => {
  try {
    setLessonsLoading(true);

    const publishedLessons =
      await getTeacherPublishedLessons(businessStudiesSubjectId);

    setLessons(publishedLessons);

if (publishedLessons.length > 0) {
  const newestTerm = Math.max(
    ...publishedLessons.map((lesson) => lesson.term_number)
  );

  setOpenTerm((currentTerm) => currentTerm ?? newestTerm);
}
  } catch (error) {
    console.error("Failed to load lessons:", error);
  } finally {
    setLessonsLoading(false);
  }
};

const handleDeleteDraftLesson = async (
  lessonId: string,
  lessonTitle: string
) => {
  const confirmed = window.confirm(
    `Delete the draft lesson "${lessonTitle}"? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDraftLesson(lessonId);

    if (currentLessonId === lessonId) {
      setCurrentLessonId(null);
      setLessonNumber("");
      setLessonTitle("");
      setTermNumber("");
      setWeekNumber("");
      setReadingTitle("");
      setReadingText("");
      setVideoTitle("");
      setVideoUrl("");
      setQuizQuestions([]);
      setActiveContentPanel(null);
    }

    await loadLessons();
    alert("Draft lesson deleted.");
  } catch (error) {
    console.error("Unable to delete draft lesson:", error);
    alert("Unable to delete the draft lesson.");
  }
};

const handleDeletePublishedLesson = async (lesson: PublishedLesson) => {
  if (deletingPublishedLessonId) return;

  const lessonLabel = `Lesson ${lesson.lesson_number} - ${lesson.title}`;
  const confirmed = window.confirm(
    `Delete "${lessonLabel}"?\n\nThis will permanently remove the lesson and its attached materials. This cannot be undone.`,
  );

  if (!confirmed) return;

  try {
    setDeletingPublishedLessonId(lesson.id);
    const response = await fetch(
      `/api/teacher/business-studies/lessons/${lesson.id}`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      throw new Error(result.error || "The lesson could not be deleted.");
    }

    setLessons((currentLessons) =>
      currentLessons.filter((currentLesson) => currentLesson.id !== lesson.id),
    );
    alert(`"${lessonLabel}" was deleted successfully.`);
  } catch (error) {
    console.error("Delete published lesson error:", error);
    alert(
      error instanceof Error
        ? error.message
        : "The lesson could not be deleted. Please try again.",
    );
  } finally {
    setDeletingPublishedLessonId(null);
  }
};

const handleOpenLesson = async (lessonId: string) => {
  try {
    setIsLoadingLesson(true);

    const editorData = await getLessonEditorData(lessonId);

    setCurrentLessonId(editorData.lesson.id);
    setLessonNumber(editorData.lesson.lesson_number);
    setLessonTitle(editorData.lesson.title);
    setTermNumber(String(editorData.lesson.term_number));
    setWeekNumber(String(editorData.lesson.week_number));

    setReadingTitle(editorData.reading?.title ?? "");
    setReadingText(editorData.reading?.content_text ?? "");

    setVideoTitle(editorData.video?.title ?? "");
    setVideoUrl(editorData.video?.content_url ?? "");

    setQuizQuestions(
      editorData.quiz?.questions.map((question, index) => ({
        id: index + 1,
        questionText: question.question_text,
        answerText: question.answer_text ?? "",
        marks: 1 as const,
      })) ?? []
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (error) {
    console.error("Unable to load lesson:", error);
    alert("Unable to open the lesson.");
  } finally {
    setIsLoadingLesson(false);
  }
};

useEffect(() => {
  loadLessons();
}, []);

const sortedLessons = [...lessons].sort((a, b) => {
  if (a.term_number !== b.term_number) {
    return b.term_number - a.term_number;
  }

  if (a.week_number !== b.week_number) {
    return b.week_number - a.week_number;
  }

  return b.lesson_number.localeCompare(
    a.lesson_number,
    undefined,
    { numeric: true }
  );
});

const groupedLessons = sortedLessons.reduce<
  Record<number, Record<number, PublishedLesson[]>>
>((groups, lesson) => {
  const term = lesson.term_number;
  const week = lesson.week_number;

  if (!groups[term]) {
    groups[term] = {};
  }

  if (!groups[term][week]) {
    groups[term][week] = [];
  }

  groups[term][week].push(lesson);

  return groups;
}, {});

  const handlePublishLesson = async () => {
  if (!currentLessonId) {
    alert("Please save the lesson as a draft before publishing.");
    return;
  }

  if (!lessonNumber.trim()) {
    alert("Please enter a lesson number.");
    return;
  }

  if (!lessonTitle.trim()) {
    alert("Please enter a lesson title.");
    return;
  }

  if (!termNumber) {
    alert("Please select a term.");
    return;
  }

  if (!weekNumber) {
    alert("Please select a week.");
    return;
  }

  if (!hasCoursework) {
    alert("Please add at least one coursework item: a reading or a video.");
    return;
  }

  if (!hasQuiz) {
    alert("Please add a quiz before publishing the lesson.");
    return;
  }

  try {
    await updateLessonStatus(currentLessonId, "published");

    await loadLessons();

    alert("Lesson published successfully.");

    setCurrentLessonId(null);
    setLessonNumber("");
    setLessonTitle("");
    setTermNumber("");
    setWeekNumber("");
    setReadingTitle("");
    setReadingText("");
    setVideoTitle("");
    setVideoUrl("");
    setQuizQuestions([]);
    setActiveContentPanel(null);
  } catch (error) {
    console.error("Failed to publish lesson:", error);

    const message =
      error instanceof Error ? error.message : "Unknown database error";

    alert(`Lesson could not be published: ${message}`);
  }
};

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
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
        href="/teacher/subjects/business-studies"
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-white">
        Classroom Management
      </h1>

      <p className="mt-1 text-sm text-white/90">
        Business Studies 
      </p>
    </div>
  </div>
</div>

        {/* Create Lesson */}

        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <Plus className="text-orange-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Create Lesson
              </h2>

              <p className="text-sm text-slate-500">
                Build a new lesson for learners
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
  <select
    value={termNumber}
    onChange={(e) => setTermNumber(e.target.value)}
    className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
  >
    <option value="">Select Term</option>
    <option value="1">Term 1</option>
    <option value="2">Term 2</option>
    <option value="3">Term 3</option>
    <option value="4">Term 4</option>
  </select>

  <select
    value={weekNumber}
    onChange={(e) => setWeekNumber(e.target.value)}
    className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
  >
    <option value="">Select Week</option>

    {Array.from({ length: 15 }, (_, index) => index + 1).map(
      (week) => (
        <option key={week} value={week}>
          Week {week}
        </option>
      )
    )}
  </select>
</div>
            <input
              value={lessonNumber}
              onChange={(e) => setLessonNumber(e.target.value)}
              placeholder="Lesson Number, for example 2.7"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />
            <input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Lesson Title"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />


          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
  <button
    type="button"
    onClick={() => setActiveContentPanel("video")}
    className="rounded-2xl bg-orange-50 p-4 text-center"
  >
    <Video
      className="mx-auto mb-2 text-orange-500"
      size={20}
    />

    <p className="text-xs font-medium">
      Video
    </p>

    <p className="mt-1 text-[11px] text-slate-500">
      {hasVideo ? "Added" : "Not added"}
    </p>
  </button>

  <button
    type="button"
    onClick={() => setActiveContentPanel("reading")}
    className="rounded-2xl bg-orange-50 p-4 text-center"
  >
    <BookOpen
      className="mx-auto mb-2 text-orange-500"
      size={20}
    />

    <p className="text-xs font-medium">
      Reading
    </p>

    <p className="mt-1 text-[11px] text-slate-500">
      {hasReading ? "Added" : "Not added"}
    </p>
  </button>

  <button
    type="button"
    onClick={() => setActiveContentPanel("quiz")}
    className="rounded-2xl bg-orange-50 p-4 text-center"
  >
    <HelpCircle
      className="mx-auto mb-2 text-orange-500"
      size={20}
    />

    <p className="text-xs font-medium">
      Quiz
    </p>

    <p className="mt-1 text-[11px] text-slate-500">
      {hasQuiz
        ? `${quizQuestions.length} question${
            quizQuestions.length === 1 ? "" : "s"
          }`
        : "Not added"}
    </p>
  </button>
</div>

          <button
            onClick={handlePublishLesson}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-semibold text-white"
          >
            <Rocket size={18} />
            Publish Lesson
          </button>
          {activeContentPanel && (
  <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 px-4 py-6 sm:items-center">
    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            {activeContentPanel === "video" && "Add Video"}
            {activeContentPanel === "reading" && "Add Reading"}
            {activeContentPanel === "quiz" && "Build Quiz"}
          </h3>

          <p className="text-sm text-slate-500">
            Add content before publishing the lesson
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveContentPanel(null)}
          className="rounded-full bg-slate-100 p-2 text-slate-600"
        >
          <X size={20} />
        </button>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        {activeContentPanel === "video" && (
  <div className="space-y-4">
    <input
      value={videoTitle}
      onChange={(event) => setVideoTitle(event.target.value)}
      placeholder="Video Title"
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
    />

    <input
      value={videoUrl}
      onChange={(event) => setVideoUrl(event.target.value)}
      placeholder="YouTube Video URL"
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
    />

    <button
      type="button"
      onClick={async () => {
        if (!videoTitle.trim() || !videoUrl.trim()) {
          alert("Please add both a video title and YouTube URL.");
          return;
        }

        try {
          const lessonId = await ensureDraftLesson();

          await publishLessonMaterial({
            lessonId,
            materialType: "video",
            sourceType: "youtube",
            title: videoTitle.trim(),
            required: true,
            contentUrl: videoUrl.trim(),
            displayOrder: 2,
          });

          setActiveContentPanel(null);
          alert("Video saved.");
        } catch (error) {
          console.error("Unable to save video:", error);
          alert("Unable to save the video.");
        }
      }}
      className="w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white"
    >
      Save Video Draft
    </button>

    {hasVideo && (
      <p className="text-center text-sm font-medium text-green-700">
        Video draft added
      </p>
    )}
  </div>
)}

       {activeContentPanel === "reading" && (
  <div className="space-y-4">
    <input
      value={readingTitle}
      onChange={(e) => setReadingTitle(e.target.value)}
      placeholder="Reading Title"
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
    />

    <textarea
      value={readingText}
      onChange={(e) => setReadingText(e.target.value)}
      placeholder="Paste the reading text here"
      rows={12}
      className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 outline-none"
    />

    <button
      type="button"
     onClick={async () => {
  if (!readingTitle.trim() || !readingText.trim()) {
    alert("Please add both a reading title and reading text.");
    return;
  }

  try {
    const lessonId = await ensureDraftLesson();

    await publishLessonMaterial({
      lessonId,
      materialType: "reading",
      sourceType: "pasted_text",
      title: readingTitle.trim(),
      required: true,
      contentText: readingText.trim(),
      displayOrder: 1,
    });

    setActiveContentPanel(null);
    alert("Reading saved.");
  } catch (error) {
    console.error(error);
    alert("Unable to save the reading.");
  }
}}
      className="w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white"
    >
      Save Reading Draft
    </button>
    {hasReading && (
  <p className="text-center text-sm font-medium text-green-700">
    Reading draft added
  </p>
)}
  </div>
)}

       {activeContentPanel === "quiz" && (
  <div className="space-y-4">
    {!hasReading && (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-medium text-amber-800">
          Add a reading first so Kingdom can generate the quiz from it.
        </p>
      </div>
    )}

    <button
  type="button"
  onClick={askKingdomForQuiz}
  disabled={!hasReading || isAskingKingdom}
  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
  <Shield
    size={20}
    style={{ color: "#e8b017" }}
  />

  {isAskingKingdom
    ? "Kingdom is creating the quiz..."
    : "Ask Kingdom"}
</button>

{quizQuestions.length > 0 && (
  <div className="space-y-3">
    {quizQuestions.map((question, index) => (
      <div
        key={question.id}
        className="rounded-2xl border border-orange-100 bg-white p-3"
      >
        <p className="mb-2 text-sm font-bold text-slate-900">
          Question {index + 1}
        </p>

        <input
          value={question.questionText}
          onChange={(event) =>
            setQuizQuestions((currentQuestions) =>
              currentQuestions.map((currentQuestion) =>
                currentQuestion.id === question.id
                  ? {
                      ...currentQuestion,
                      questionText: event.target.value,
                    }
                  : currentQuestion
              )
            )
          }
          placeholder="Quiz question"
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
        />
      </div>
    ))}
  </div>
)}

    <div className="rounded-2xl bg-orange-50 p-3 text-sm font-semibold text-slate-700">
      Total Quiz Marks: {quizQuestions.length}/10
    </div>

    <button
      type="button"
      onClick={async () => {
  if (quizQuestions.length !== 10) {
    alert("Ask Kingdom to create the 10-question quiz first.");
    return;
  }

  const hasIncompleteQuestion = quizQuestions.some(
    (question) => !question.questionText.trim()
  );

  if (hasIncompleteQuestion) {
    alert("Every quiz question must contain text.");
    return;
  }

  try {
    const lessonId = await ensureDraftLesson();

    await publishLessonQuiz({
      lessonId,
      lessonTitle: lessonTitle.trim(),
      questions: quizQuestions,
    });

    setActiveContentPanel(null);
    alert("Quiz saved.");
  } catch (error) {
    console.error("Unable to save quiz:", error);
    alert("Unable to save the quiz.");
  }
}}
      className="w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white"
    >
      Save Quiz
    </button>
  </div>
)}
      </div>
    </div>
  </div>
)}
        </div>

        {/* Published Lessons */}

        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <FileText
                className="text-orange-500"
                size={22}
              />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Lesson Library
              </h2>

              <p className="text-sm text-slate-500">
                Lessons available to learners
              </p>
            </div>
          </div>

          <div className="space-y-6">
  {lessonsLoading ? (
    <p className="text-sm text-slate-500">
      Loading published lessons...
    </p>
  ) : lessons.length === 0 ? (
    <p className="text-sm text-slate-500">
      No published lessons yet.
    </p>
  ) : (
    Object.entries(groupedLessons)
  .sort(([termA], [termB]) => Number(termB) - Number(termA))
  .map(([term, weeks]) => (
      <div
  key={term}
  className="overflow-hidden rounded-2xl border border-orange-100"
>
  <button
    type="button"
    onClick={() =>
      setOpenTerm((currentTerm) =>
        currentTerm === Number(term) ? null : Number(term)
      )
    }
    className="flex w-full items-center justify-between bg-orange-50 px-4 py-3 text-left"
  >
    <span className="text-lg font-bold text-slate-900">
      Term {term}
    </span>

    {openTerm === Number(term) ? (
      <ChevronDown className="text-orange-500" size={20} />
    ) : (
      <ChevronRight className="text-orange-500" size={20} />
    )}
  </button>

  {openTerm === Number(term) && (
    <div className="space-y-5 p-4">
  {Object.entries(weeks)
    .sort(([weekA], [weekB]) => Number(weekB) - Number(weekA))
    .map(([week, weekLessons]) => (
      <div key={week}>
              <p className="mb-2 text-sm font-bold text-orange-500">
                Week {week}
              </p>

              <div className="space-y-3">
                {weekLessons.map((lesson) => (
                  <div
  key={lesson.id}
  className="rounded-2xl border border-orange-100 p-4"
>
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={() => handleOpenLesson(lesson.id)}
      disabled={isLoadingLesson}
      className="min-w-0 flex-1 text-left disabled:cursor-wait disabled:opacity-60"
    >
      <h4 className="font-semibold text-slate-900">
        Lesson {lesson.lesson_number} - {lesson.title}
      </h4>
    </button>

    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          lesson.status === "published"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {lesson.status === "published" ? "Published" : "Draft"}
      </span>

      {lesson.status === "draft" && (
        <button
          type="button"
          onClick={() =>
            handleDeleteDraftLesson(
              lesson.id,
              `Lesson ${lesson.lesson_number} - ${lesson.title}`
            )
          }
          className="rounded-full bg-orange-50 p-2 text-orange-500 transition hover:bg-orange-100"
          aria-label={`Delete Lesson ${lesson.lesson_number}`}
          title="Delete draft lesson"
        >
          <Trash2 size={17} />
        </button>
      )}

      {lesson.status === "published" && (
        <button
          type="button"
          onClick={() => handleDeletePublishedLesson(lesson)}
          disabled={deletingPublishedLessonId !== null}
          className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Delete Lesson ${lesson.lesson_number}`}
        >
          <Trash2 size={15} />
          {deletingPublishedLessonId === lesson.id
            ? "Deleting..."
            : "Delete Lesson"}
        </button>
      )}
    </div>
  </div>
</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    ))
  )}
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
      </div>
    </main>
  );
}
