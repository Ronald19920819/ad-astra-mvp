"use client";
import { updateLessonStatus } from "@/lib/supabase/lessonStatusUpdater";
import { updateLessonDetails } from "@/lib/supabase/lessonDetailsUpdater";
import { publishLesson } from "@/lib/supabase/lessonPublisher";
import { publishLessonMaterial } from "@/lib/supabase/lessonMaterialPublisher";
import { publishLessonQuiz } from "@/lib/supabase/lessonQuizPublisher";
import { deleteDraftLesson } from "@/lib/supabase/lessonDeleter";
import {
  getTeacherPublishedLessonsWithContentSummary,
  type TeacherPublishedLesson,
} from "@/lib/supabase/lessonReader";
import {
  getLessonEditorData,
} from "@/lib/supabase/lessonEditorReader";
import {
  createLessonTopic,
  getLessonTopics,
  type LessonTopic,
} from "@/lib/supabase/lessonTopicReader";
import {
  editorTextToStructuredReading,
  readingContentToEditorText,
  readingContentToPlainText,
  serializeStructuredReading,
} from "@/lib/readings/structuredReading";
import {
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import { useEffect, useState, type CSSProperties } from "react";
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
  ClipboardList,
  FileQuestion,
  Pencil,
  Rocket,
  Video,
  Shield,
  Trash2,
  X,
} from "lucide-react";

type LessonQuizQuestion = {
  id: number;
  questionId?: string;
  questionText: string;
  answerText: string;
  marks: 1;
};

function quizEditorSignature(questions: LessonQuizQuestion[]) {
  return JSON.stringify(
    questions.map((question) => ({
      questionId: question.questionId ?? null,
      questionText: question.questionText,
      answerText: question.answerText,
      marks: question.marks,
    })),
  );
}

type LessonWeekGroup = {
  key: string;
  weekNumber: number | null;
  lessons: TeacherPublishedLesson[];
};

type LessonTermGroup = {
  key: string;
  termNumber: number | null;
  weeks: Record<string, LessonWeekGroup>;
};

export function TeacherSubjectClassroomPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const [lessonNumber, setLessonNumber] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [termNumber, setTermNumber] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [lessonTopics, setLessonTopics] = useState<LessonTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicError, setTopicError] = useState("");
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [readingTitle, setReadingTitle] = useState("");
  const [readingText, setReadingText] = useState("");
  const [readingWorkflow, setReadingWorkflow] = useState<
    "write" | "generate" | null
  >(null);
  const [structureMode, setStructureMode] = useState<
    "formatting_only" | "formatting_and_language"
  >("formatting_only");
  const [isProcessingReading, setIsProcessingReading] = useState(false);
  const [readingKingdomError, setReadingKingdomError] = useState("");
  const [learnerLevel, setLearnerLevel] = useState("");
  const [generationInstruction, setGenerationInstruction] = useState("");
  const [generationValidation, setGenerationValidation] = useState({
    learnerLevel: "",
    instruction: "",
  });
  const [generatedDraftBaseline, setGeneratedDraftBaseline] = useState<
    string | null
  >(null);
  const [readingIsSaved, setReadingIsSaved] = useState(false);
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
    const readingDocument = editorTextToStructuredReading(readingText);
    if (!readingDocument) {
      alert("The reading could not be prepared for quiz generation.");
      return;
    }
    const quizReadingText = readingContentToPlainText(
      serializeStructuredReading(readingDocument.blocks),
    );

    const response = await fetch("/api/kingdom/generate-lesson-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subjectKey,
        readingTitle: readingTitle.trim(),
        readingText: quizReadingText,
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
  const [lessons, setLessons] = useState<TeacherPublishedLesson[]>([]);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingContentBaseline, setEditingContentBaseline] = useState<{
    lessonTitle: string;
    readingTitle: string;
    readingText: string;
    videoTitle: string;
    videoUrl: string;
    quizSignature: string;
  } | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [deletingPublishedLessonId, setDeletingPublishedLessonId] = useState<
    string | null
  >(null);
  const subjectId = subject.databaseId;
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
    subjectId,
    lessonNumber: lessonNumber.trim(),
    title: lessonTitle.trim(),
    termNumber: Number(termNumber),
    weekNumber: Number(weekNumber),
    topicId: selectedTopicId || null,
    expectedCompletionDate: expectedCompletionDate || null,
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
      await getTeacherPublishedLessonsWithContentSummary(
        subjectId,
      );

    setLessons(publishedLessons);

if (publishedLessons.length > 0) {
  const newestTerm = publishedLessons.reduce<number | null>(
    (newest, lesson) =>
      lesson.term_number !== null &&
      (newest === null || lesson.term_number > newest)
        ? lesson.term_number
        : newest,
    null,
  );
  const newestTermKey =
    newestTerm === null ? "term-unscheduled" : `term-${newestTerm}`;

  setOpenTerm((currentTerm) => currentTerm ?? newestTermKey);
}
  } catch (error) {
    console.error("Failed to load lessons:", error);
  } finally {
    setLessonsLoading(false);
  }
};

const loadTopics = async () => {
  try {
    setTopicsLoading(true);
    setTopicError("");
    setLessonTopics(await getLessonTopics(subjectId));
  } catch (error) {
    console.error("Failed to load lesson topics:", error);
    setTopicError("Unable to load lesson topics.");
  } finally {
    setTopicsLoading(false);
  }
};

const handleCreateTopic = async () => {
  const title = newTopicTitle.trim().replace(/\s+/g, " ");
  if (!title) {
    setTopicError("Enter a topic title.");
    return;
  }

  const existingTopic = lessonTopics.find(
    (topic) => topic.title.toLocaleLowerCase("en") ===
      title.toLocaleLowerCase("en"),
  );
  if (existingTopic) {
    setSelectedTopicId(existingTopic.id);
    setNewTopicTitle("");
    setShowNewTopic(false);
    setTopicError("");
    return;
  }

  try {
    setIsCreatingTopic(true);
    setTopicError("");
    const topic = await createLessonTopic(subjectId, title);
    setLessonTopics((currentTopics) =>
      currentTopics.some((currentTopic) => currentTopic.id === topic.id)
        ? currentTopics
        : [...currentTopics, topic].sort((topicA, topicB) =>
            topicA.title.localeCompare(topicB.title),
          ),
    );
    setSelectedTopicId(topic.id);
    setNewTopicTitle("");
    setShowNewTopic(false);
  } catch (error) {
    console.error("Failed to create lesson topic:", error);
    setTopicError(
      error instanceof Error
        ? error.message
        : "The lesson topic could not be created.",
    );
  } finally {
    setIsCreatingTopic(false);
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
    await deleteDraftLesson(subjectId, lessonId);

    if (currentLessonId === lessonId) {
      setCurrentLessonId(null);
      setEditingLessonId(null);
      setEditingContentBaseline(null);
      setLessonNumber("");
      setLessonTitle("");
      setTermNumber("");
      setWeekNumber("");
      setSelectedTopicId("");
      setExpectedCompletionDate("");
      setReadingTitle("");
      setReadingText("");
      setReadingWorkflow(null);
      setReadingIsSaved(false);
      setGeneratedDraftBaseline(null);
      setGenerationInstruction("");
      setLearnerLevel("");
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

const handleDeletePublishedLesson = async (lesson: TeacherPublishedLesson) => {
  if (deletingPublishedLessonId) return;

  const lessonLabel = `Lesson ${lesson.lesson_number} - ${lesson.title}`;
  const confirmed = window.confirm(
    `Delete "${lessonLabel}"?\n\nThis will permanently remove the lesson and its attached materials. This cannot be undone.`,
  );

  if (!confirmed) return;

  try {
    setDeletingPublishedLessonId(lesson.id);
    const response = await fetch(
      `/api/teacher/business-studies/lessons/${lesson.id}?subjectId=${encodeURIComponent(subjectId)}`,
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

    const editorData = await getLessonEditorData(lessonId, subjectId);

    setCurrentLessonId(editorData.lesson.id);
    setEditingLessonId(
      editorData.lesson.status === "published" ? editorData.lesson.id : null,
    );
    setLessonNumber(editorData.lesson.lesson_number);
    setLessonTitle(editorData.lesson.title);
    setTermNumber(
      editorData.lesson.term_number === null
        ? ""
        : String(editorData.lesson.term_number),
    );
    setWeekNumber(
      editorData.lesson.week_number === null
        ? ""
        : String(editorData.lesson.week_number),
    );
    setExpectedCompletionDate(
      editorData.lesson.expected_completion_date ?? "",
    );
    setSelectedTopicId(editorData.lesson.topic_id ?? "");

    const loadedReadingTitle = editorData.reading?.title ?? "";
    const loadedReadingText = readingContentToEditorText(
      editorData.reading?.content_text ?? "",
    );
    const loadedVideoTitle = editorData.video?.title ?? "";
    const loadedVideoUrl = editorData.video?.content_url ?? "";
    const loadedQuizQuestions =
      editorData.quiz?.questions.map((question, index) => ({
        id: index + 1,
        questionId: question.id,
        questionText: question.question_text,
        answerText: question.answer_text ?? "",
        marks: 1 as const,
      })) ?? [];

    setReadingTitle(loadedReadingTitle);
    setReadingText(loadedReadingText);
    setReadingWorkflow(editorData.reading ? "write" : null);
    setReadingKingdomError("");
    setReadingIsSaved(Boolean(editorData.reading));
    setGeneratedDraftBaseline(null);

    setVideoTitle(loadedVideoTitle);
    setVideoUrl(loadedVideoUrl);

    setQuizQuestions(loadedQuizQuestions);
    setEditingContentBaseline({
      lessonTitle: editorData.lesson.title,
      readingTitle: loadedReadingTitle,
      readingText: loadedReadingText,
      videoTitle: loadedVideoTitle,
      videoUrl: loadedVideoUrl,
      quizSignature: quizEditorSignature(loadedQuizQuestions),
    });

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
  void loadLessons().then(loadTopics);
  // The loaders intentionally run once for the subject mounted by this route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const sortedLessons = [...lessons].sort((a, b) => {
  if (a.term_number !== b.term_number) {
    return (b.term_number ?? Number.NEGATIVE_INFINITY) -
      (a.term_number ?? Number.NEGATIVE_INFINITY);
  }

  if (a.week_number !== b.week_number) {
    return (b.week_number ?? Number.NEGATIVE_INFINITY) -
      (a.week_number ?? Number.NEGATIVE_INFINITY);
  }

  return b.lesson_number.localeCompare(
    a.lesson_number,
    undefined,
    { numeric: true }
  );
});

const groupedLessons = sortedLessons.reduce<
  Record<string, LessonTermGroup>
>((groups, lesson) => {
  const term = lesson.term_number;
  const week = lesson.week_number;
  const termKey = term === null ? "term-unscheduled" : `term-${term}`;
  const weekKey = week === null ? "week-unscheduled" : `week-${week}`;

  if (!groups[termKey]) {
    groups[termKey] = {
      key: termKey,
      termNumber: term,
      weeks: {},
    };
  }

  if (!groups[termKey].weeks[weekKey]) {
    groups[termKey].weeks[weekKey] = {
      key: weekKey,
      weekNumber: week,
      lessons: [],
    };
  }

  groups[termKey].weeks[weekKey].lessons.push(lesson);

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
    const readingChanged =
      editingLessonId !== null &&
      (readingTitle !== editingContentBaseline?.readingTitle ||
        readingText !== editingContentBaseline?.readingText);
    if (hasReading && readingChanged) {
      const readingDocument = editorTextToStructuredReading(readingText);
      if (!readingDocument) {
        alert("The reading needs valid content before it can be saved.");
        return;
      }
      await publishLessonMaterial({
        subjectId,
        lessonId: currentLessonId,
        materialType: "reading",
        sourceType: "pasted_text",
        title: readingTitle.trim(),
        required: true,
        contentText: serializeStructuredReading(readingDocument.blocks),
        displayOrder: 1,
      });
    }

    const videoChanged =
      editingLessonId !== null &&
      (videoTitle !== editingContentBaseline?.videoTitle ||
        videoUrl !== editingContentBaseline?.videoUrl);
    if (hasVideo && videoChanged) {
      await publishLessonMaterial({
        subjectId,
        lessonId: currentLessonId,
        materialType: "video",
        sourceType: "youtube",
        title: videoTitle.trim(),
        required: true,
        contentUrl: videoUrl.trim(),
        displayOrder: 2,
      });
    }

    const quizChanged =
      editingLessonId !== null &&
      (quizEditorSignature(quizQuestions) !==
        editingContentBaseline?.quizSignature ||
        lessonTitle !== editingContentBaseline?.lessonTitle);
    if (hasQuiz && quizChanged) {
      await publishLessonQuiz({
        subjectId,
        lessonId: currentLessonId,
        lessonTitle: lessonTitle.trim(),
        questions: quizQuestions,
      });
    }

    await updateLessonDetails({
      subjectId,
      lessonId: currentLessonId,
      lessonNumber: lessonNumber.trim(),
      title: lessonTitle.trim(),
      termNumber: Number(termNumber),
      weekNumber: Number(weekNumber),
      topicId: selectedTopicId || null,
      expectedCompletionDate: expectedCompletionDate || null,
    });
    await updateLessonStatus(subjectId, currentLessonId, "published");

    await loadLessons();

    alert(
      editingLessonId
        ? "Lesson changes saved successfully."
        : "Lesson published successfully.",
    );

    setCurrentLessonId(null);
    setEditingLessonId(null);
    setEditingContentBaseline(null);
    setLessonNumber("");
    setLessonTitle("");
    setTermNumber("");
    setWeekNumber("");
    setSelectedTopicId("");
    setExpectedCompletionDate("");
    setReadingTitle("");
    setReadingText("");
    setReadingWorkflow(null);
    setReadingIsSaved(false);
    setGeneratedDraftBaseline(null);
    setGenerationInstruction("");
    setLearnerLevel("");
    setVideoTitle("");
    setVideoUrl("");
    setQuizQuestions([]);
    setActiveContentPanel(null);
    document.getElementById("lesson-library")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Failed to publish lesson:", error);

    const message =
      error instanceof Error ? error.message : "Unknown database error";

    alert(`Lesson could not be published: ${message}`);
  }
};

const saveReadingDraft = async () => {
  if (!readingTitle.trim() || !readingText.trim()) {
    alert("Please add both a reading title and reading text.");
    return;
  }

  const document = editorTextToStructuredReading(readingText);
  if (!document) {
    alert("The reading needs valid content before it can be saved.");
    return;
  }

  try {
    const lessonId = await ensureDraftLesson();
    await publishLessonMaterial({
      subjectId,
      lessonId,
      materialType: "reading",
      sourceType: "pasted_text",
      title: readingTitle.trim(),
      required: true,
      contentText: serializeStructuredReading(document.blocks),
      displayOrder: 1,
    });

    setReadingIsSaved(true);
    setActiveContentPanel(null);
    alert("Reading saved.");
  } catch (error) {
    console.error("Unable to save reading:", error);
    alert("Unable to save the reading.");
  }
};

const structureReadingWithKingdom = async () => {
  if (!readingTitle.trim() || !readingText.trim()) {
    setReadingKingdomError(
      "Add a reading title and your original content first.",
    );
    return;
  }

  try {
    setIsProcessingReading(true);
    setReadingKingdomError("");
    const response = await fetch("/api/kingdom/structure-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectKey,
        readingTitle: readingTitle.trim(),
        teacherContent: readingText,
        mode: structureMode,
      }),
    });
    const result = (await response.json()) as {
      editorText?: string;
      error?: string;
    };

    if (!response.ok || !result.editorText) {
      throw new Error(result.error || "Kingdom could not structure the reading.");
    }

    setReadingText(result.editorText);
  } catch (error) {
    console.error("Kingdom reading structure error:", error);
    setReadingKingdomError(
      error instanceof Error
        ? error.message
        : "Kingdom could not structure the reading. Your original content is unchanged.",
    );
  } finally {
    setIsProcessingReading(false);
  }
};

const generateReadingWithKingdom = async (isRegeneration = false) => {
  const validation = {
    learnerLevel: learnerLevel.trim()
      ? ""
      : "Phase / learner level is required.",
    instruction: generationInstruction.trim()
      ? ""
      : "Describe the reading you want Kingdom to create.",
  };
  setGenerationValidation(validation);

  if (validation.learnerLevel || validation.instruction) return;

  if (isRegeneration || (readingIsSaved && readingText.trim())) {
    const generatedDraftWasEdited =
      generatedDraftBaseline !== null &&
      readingText !== generatedDraftBaseline;
    const warning = readingIsSaved
      ? "A version of this reading has already been saved. Regenerating will replace only the editor draft; the saved reading will not change until you select Save Reading. Continue?"
      : generatedDraftWasEdited
        ? "You have edited this generated draft. Regenerating will replace those unsaved edits. Continue?"
        : "";

    if (warning && !window.confirm(warning)) return;
  }

  try {
    setIsProcessingReading(true);
    setReadingKingdomError("");
    const response = await fetch("/api/kingdom/generate-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectKey,
        subject: subject.displayName,
        readingTitle: readingTitle.trim(),
        learnerLevel: learnerLevel.trim(),
        instruction: generationInstruction.trim(),
      }),
    });
    const result = (await response.json()) as {
      editorText?: string;
      error?: string;
    };

    if (!response.ok || !result.editorText) {
      throw new Error(result.error || "Kingdom could not generate the reading.");
    }

    setReadingText(result.editorText);
    setGeneratedDraftBaseline(result.editorText);
    setReadingWorkflow("write");
  } catch (error) {
    console.error("Kingdom reading generation error:", error);
    setReadingKingdomError(
      error instanceof Error
        ? error.message
        : "Kingdom could not generate the reading. Please try again.",
    );
  } finally {
    setIsProcessingReading(false);
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
        href={subject.routes.teacherOverview}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-white">
        Classroom Management
      </h1>

      <p className="mt-1 text-sm text-white/90">
        {subject.displayName}
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="lesson-topic"
                  className="text-sm font-semibold text-slate-700"
                >
                  Topic{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTopic((current) => !current);
                    setTopicError("");
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600"
                >
                  <Plus size={15} />
                  Create new topic
                </button>
              </div>

              <select
                id="lesson-topic"
                value={selectedTopicId}
                onChange={(event) => setSelectedTopicId(event.target.value)}
                disabled={topicsLoading}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {topicsLoading ? "Loading topics..." : "No topic"}
                </option>
                {lessonTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>

              {showNewTopic && (
                <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
                  <input
                    value={newTopicTitle}
                    onChange={(event) => setNewTopicTitle(event.target.value)}
                    placeholder="New topic title"
                    maxLength={200}
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTopic}
                    disabled={isCreatingTopic}
                    className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingTopic ? "Creating..." : "Add topic"}
                  </button>
                </div>
              )}

              {topicError && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {topicError}
                </p>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Expected Completion{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(event) =>
                  setExpectedCompletionDate(event.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
              />
            </label>


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
    onClick={() => {
      setActiveContentPanel("reading");
      setReadingWorkflow(readingText.trim() ? "write" : null);
      setReadingKingdomError("");
    }}
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
            {editingLessonId ? <Pencil size={18} /> : <Rocket size={18} />}
            {editingLessonId ? "Save Changes" : "Publish Lesson"}
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
            subjectId,
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
    <div>
      <label
        htmlFor="reading-title"
        className="mb-1 block text-sm font-bold text-slate-700"
      >
        Lesson name
      </label>
      <input
        id="reading-title"
        value={readingTitle}
        onChange={(event) => setReadingTitle(event.target.value)}
        placeholder="Reading or lesson name"
        className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none"
      />
    </div>

    {readingWorkflow === null && (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setReadingWorkflow("write")}
          className="rounded-2xl border border-orange-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="font-bold text-slate-900">Write or Paste Reading</p>
          <p className="mt-1 text-sm text-slate-500">
            Type your own material or paste an existing reading.
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setReadingWorkflow("generate");
            setReadingTitle((current) => current || lessonTitle);
            setReadingKingdomError("");
            setGenerationValidation({ learnerLevel: "", instruction: "" });
          }}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left text-white shadow-sm"
        >
          <p className="font-bold">Generate Reading with Kingdom</p>
          <p className="mt-1 text-sm text-slate-300">
            Plan a new {subject.displayName} textbook reading.
          </p>
        </button>
      </div>
    )}

    {readingWorkflow === "write" && (
      <div className="space-y-4">
        <textarea
          value={readingText}
          onChange={(event) => {
            setReadingText(event.target.value);
            setReadingKingdomError("");
          }}
          placeholder="Write or paste the reading here"
          rows={15}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 outline-none"
        />
        <p className="text-xs leading-5 text-slate-500">
          The editor remains fully editable. Use # for a heading, ## for a
          subheading, - for bullets, 1. for numbered steps, and Term ::
          Definition for key terms.
        </p>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-slate-900">Structure with Kingdom</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setStructureMode("formatting_only")}
              className={`rounded-xl border p-3 text-left text-sm ${
                structureMode === "formatting_only"
                  ? "border-amber-500 bg-white"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <span className="font-bold">Formatting only</span>
              <span className="mt-1 block text-slate-600">
                Preserve wording and organise the existing content.
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setStructureMode("formatting_and_language")
              }
              className={`rounded-xl border p-3 text-left text-sm ${
                structureMode === "formatting_and_language"
                  ? "border-amber-500 bg-white"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <span className="font-bold">
                Formatting and language polish
              </span>
              <span className="mt-1 block text-slate-600">
                Improve clarity and flow while preserving factual meaning.
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={structureReadingWithKingdom}
            disabled={isProcessingReading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60"
          >
            <Shield size={18} className="text-[#E8B017]" />
            {isProcessingReading
              ? "Kingdom is structuring the reading..."
              : "Structure with Kingdom"}
          </button>
        </div>

        {readingKingdomError && (
          <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {readingKingdomError}
          </p>
        )}

        <button
          type="button"
          onClick={saveReadingDraft}
          disabled={isProcessingReading}
          className="w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white disabled:opacity-60"
        >
          Save Reading
        </button>
        {generatedDraftBaseline !== null && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void generateReadingWithKingdom(true)}
              disabled={isProcessingReading}
              className="rounded-2xl border border-slate-800 bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isProcessingReading ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReadingWorkflow("generate");
                setReadingKingdomError("");
              }}
              disabled={isProcessingReading}
              className="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Edit instruction
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setReadingWorkflow(null)}
          className="w-full py-2 text-sm font-semibold text-slate-500"
        >
          Back to reading options
        </button>
        {hasReading && (
          <p className="text-center text-sm font-medium text-green-700">
            Reading draft added
          </p>
        )}
      </div>
    )}

    {readingWorkflow === "generate" && (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">
            Subject
          </label>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-[#102A43]">
            {subject.displayName}
          </div>
        </div>

        <div>
          <label
            htmlFor="reading-learner-level"
            className="mb-1 block text-sm font-bold text-slate-700"
          >
            Phase / learner level
          </label>
          <input
            id="reading-learner-level"
            value={learnerLevel}
            onChange={(event) => {
              setLearnerLevel(event.target.value);
              setGenerationValidation((current) => ({
                ...current,
                learnerLevel: "",
              }));
            }}
            placeholder="For example, Cambridge IGCSE or Grade 10"
            aria-invalid={Boolean(generationValidation.learnerLevel)}
            className={`w-full rounded-2xl border bg-white p-3 outline-none ${
              generationValidation.learnerLevel
                ? "border-red-400"
                : "border-slate-200"
            }`}
          />
          {generationValidation.learnerLevel && (
            <p className="mt-1 text-sm font-semibold text-red-600">
              {generationValidation.learnerLevel}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reading-generation-instruction"
            className="mb-1 block text-sm font-bold text-slate-700"
          >
            Describe the reading you want Kingdom to create
          </label>
          <textarea
            id="reading-generation-instruction"
            value={generationInstruction}
            onChange={(event) => {
              setGenerationInstruction(event.target.value);
              setGenerationValidation((current) => ({
                ...current,
                instruction: "",
              }));
            }}
            placeholder="Explain the topic, concepts, examples, depth, style, and any other requirements."
            rows={10}
            aria-invalid={Boolean(generationValidation.instruction)}
            className={`w-full resize-y rounded-2xl border bg-white p-3 outline-none ${
              generationValidation.instruction
                ? "border-red-400"
                : "border-slate-200"
            }`}
          />
          {generationValidation.instruction && (
            <p className="mt-1 text-sm font-semibold text-red-600">
              {generationValidation.instruction}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
          <p className="font-bold text-slate-900">
            For a stronger reading, you may include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>the topic and concepts to cover</li>
            <li>the learner level</li>
            <li>definitions that must be included</li>
            <li>examples or case studies</li>
            <li>comparisons, advantages or disadvantages</li>
            <li>preferred depth</li>
            <li>tables, lists or summaries</li>
            <li>exam skills or command words to reinforce</li>
          </ul>
        </div>

        {readingKingdomError && (
          <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {readingKingdomError}
          </p>
        )}

        <button
          type="button"
          onClick={() =>
            void generateReadingWithKingdom(
              generatedDraftBaseline !== null,
            )
          }
          disabled={isProcessingReading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60"
        >
          <Shield size={18} className="text-[#E8B017]" />
          {isProcessingReading
            ? "Kingdom is generating the reading..."
            : generatedDraftBaseline !== null
              ? "Generate Fresh Draft"
              : "Generate Reading with Kingdom"}
        </button>
        <button
          type="button"
          onClick={() =>
            setReadingWorkflow(
              generatedDraftBaseline !== null ? "write" : null,
            )
          }
          disabled={isProcessingReading}
          className="w-full py-2 text-sm font-semibold text-slate-500 disabled:opacity-60"
        >
          {generatedDraftBaseline !== null
            ? "Back to generated draft"
            : "Back to reading options"}
        </button>
      </div>
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
      subjectId,
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

        <div
          id="lesson-library"
          className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm"
        >
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
    Object.values(groupedLessons)
  .sort((termA, termB) => {
    if (termA.termNumber === null) return 1;
    if (termB.termNumber === null) return -1;
    return termB.termNumber - termA.termNumber;
  })
  .map((termGroup) => (
      <div
  key={termGroup.key}
  className="overflow-hidden rounded-2xl border border-orange-100"
>
  <button
    type="button"
    onClick={() =>
      setOpenTerm((currentTerm) =>
        currentTerm === termGroup.key ? null : termGroup.key
      )
    }
    className="flex w-full items-center justify-between bg-orange-50 px-4 py-3 text-left"
  >
    <span className="text-lg font-bold text-slate-900">
      {termGroup.termNumber === null
        ? "Term not set"
        : `Term ${termGroup.termNumber}`}
    </span>

    {openTerm === termGroup.key ? (
      <ChevronDown className="text-orange-500" size={20} />
    ) : (
      <ChevronRight className="text-orange-500" size={20} />
    )}
  </button>

  {openTerm === termGroup.key && (
    <div className="space-y-5 p-4">
  {Object.values(termGroup.weeks)
    .sort((weekA, weekB) => {
      if (weekA.weekNumber === null) return 1;
      if (weekB.weekNumber === null) return -1;
      return weekB.weekNumber - weekA.weekNumber;
    })
    .map((weekGroup) => (
      <div key={weekGroup.key}>
              <p className="mb-2 text-sm font-bold text-orange-500">
                {weekGroup.weekNumber === null
                  ? "Week not set"
                  : `Week ${weekGroup.weekNumber}`}
              </p>

              <div className="space-y-3">
                {weekGroup.lessons.map((lesson) => (
                  <div
  key={lesson.id}
  className="rounded-2xl border border-orange-100 p-4"
>
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0 flex-1">
      <h4 className="font-semibold text-slate-900">
        Lesson {lesson.lesson_number} - {lesson.title}
      </h4>
    </div>

    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          lesson.status === "published"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {lesson.status === "published" ? "Published" : "Draft"}
      </span>

      <button
        type="button"
        onClick={() => handleOpenLesson(lesson.id)}
        disabled={isLoadingLesson}
        className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
        aria-label={`Edit Lesson ${lesson.lesson_number}`}
        title="Edit lesson"
      >
        <Pencil size={15} />
        Edit
      </button>

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
          aria-label="Delete lesson"
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
          className="inline-flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Delete lesson"
          title="Delete lesson"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  </div>

  {lesson.status === "published" && (
    <div
      className="mt-3 flex flex-wrap gap-2"
      aria-label={`Content attached to Lesson ${lesson.lesson_number}`}
    >
    {[
      {
        label: "Reading",
        attached: lesson.contentSummary.hasReading,
        icon: BookOpen,
      },
      {
        label: "Video",
        attached: lesson.contentSummary.hasVideo,
        icon: Video,
      },
      {
        label: "Quiz",
        attached: lesson.contentSummary.hasQuiz,
        icon: FileQuestion,
      },
      {
        label: "Activity",
        attached: lesson.contentSummary.hasActivity,
        icon: ClipboardList,
      },
    ].map(({ label, attached, icon: ContentIcon }) => (
      <span
        key={label}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${
          attached
            ? "bg-orange-50 text-orange-700"
            : "bg-slate-100 text-slate-400"
        }`}
        aria-label={`${label}: ${attached ? "attached" : "not attached"}`}
        title={`${label}: ${attached ? "attached" : "not attached"}`}
      >
        <ContentIcon size={14} aria-hidden="true" />
        {label}
      </span>
    ))}
    </div>
  )}
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
      </div>
    </main>
  );
}

export default function BusinessStudiesClassroomPage() {
  return <TeacherSubjectClassroomPage />;
}
