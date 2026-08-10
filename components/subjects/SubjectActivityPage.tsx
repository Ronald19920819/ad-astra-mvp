"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Clock, SquarePen } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import {
  getLearnerActivityData,
  type LearnerActivityWorkspaceData,
} from "@/lib/supabase/activityReader";
import type { LearnerSavedActivitySubmission } from "@/lib/supabase/learnerSubjectPageData";
import { ProtectedReading } from "@/components/learners/ProtectedReading";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";
import {
  isActivitySubmissionSnapshot,
  type ActivitySubmissionSnapshot,
} from "@/lib/activities/activitySnapshot";
import {
  answersRecordFromDraft,
  buildActivityDraftCacheKey,
  choosePreferredDraftSource,
  parseLocalLearnerActivityDraftCache,
  reconcileAnswersForQuestionIds,
  type LearnerActivityDraft,
  type LocalLearnerActivityDraftCache,
} from "@/lib/activities/activityDrafts";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isDevelopment = process.env.NODE_ENV === "development";

const activityStateMessages = {
  invalid: "This activity link is invalid.",
  "not-found": "This activity could not be found.",
  unpublished: "This activity is not available to learners.",
  "wrong-subject": "This activity belongs to a different subject.",
  "missing-reading": "This activity has no reading material available.",
  error: "We could not load this activity. Please try again.",
} as const;

function activityPercentage(mark: number | null, total: number) {
  if (mark === null || total <= 0) return null;
  return Math.round((mark / total) * 1000) / 10;
}

type ActivityState = keyof typeof activityStateMessages;

function workspaceFromSnapshot(
  snapshot: ActivitySubmissionSnapshot,
): LearnerActivityWorkspaceData {
  return {
    activity: {
      id: snapshot.activity.id,
      version: snapshot.activity.version,
      title: snapshot.activity.title,
      instructions: snapshot.activity.instructions,
      total_marks: snapshot.activity.totalMarks,
      due_date: snapshot.activity.dueDate,
      lesson_material_id: snapshot.reading.id,
    },
    reading: {
      id: snapshot.reading.id,
      title: snapshot.reading.title,
      content_text: snapshot.reading.contentText,
    },
    lesson: {
      id: snapshot.lesson.id,
      title: snapshot.lesson.title,
      lesson_number: snapshot.lesson.lessonNumber,
      term_number: snapshot.lesson.termNumber,
      week_number: snapshot.lesson.weekNumber,
    },
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      question_number: question.questionNumber,
      question_text: question.questionText,
      marks: question.marks,
      display_order: question.displayOrder,
      assessment_objective: question.assessmentObjective,
      paper: question.paper,
      question_type: question.questionType,
    })),
  };
}

type SavedActivitySubmission = LearnerSavedActivitySubmission & {
  activity_snapshot: ActivitySubmissionSnapshot | null;
};

type DraftSaveState =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "offline"
  | "newer-draft";

type DraftApiResponse = {
  learnerId: string;
  subjectId?: string;
  currentActivityVersion?: number;
  draft: LearnerActivityDraft | null;
  error?: string;
  code?: string;
};

export function SubjectActivityPage({
  subjectKey = "business-studies",
  initialActivityData,
  initialActivityState,
  initialSubmission,
  initialSubmissionLoaded = false,
}: {
  subjectKey?: SubjectKey;
  initialActivityData?: LearnerActivityWorkspaceData | null;
  initialActivityState?: ActivityState | null;
  initialSubmission?: SavedActivitySubmission | null;
  initialSubmissionLoaded?: boolean;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const themeStyle = {
    "--subject-primary": subject.colourTheme.primary,
    "--subject-soft": subject.colourTheme.softBackground,
    "--subject-border": subject.colourTheme.border,
  } as CSSProperties;
  const { activityId } = useParams<{ activityId: string }>();
  const hasInitialActivityState =
    initialActivityData !== undefined || initialActivityState !== undefined;
  const [activityData, setActivityData] =
    useState<LearnerActivityWorkspaceData | null>(initialActivityData ?? null);
  const [isLoading, setIsLoading] = useState(!hasInitialActivityState);
  const [pageState, setPageState] = useState<ActivityState | null>(
    initialActivityState ?? null,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    initialSubmission
      ? Object.fromEntries(
          initialSubmission.activity_submission_answers.map((answer) => [
            answer.question_id,
            answer.answer_text,
          ]),
        )
      : {},
  );
  const [submission, setSubmission] =
    useState<SavedActivitySubmission | null>(initialSubmission ?? null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(
    !initialSubmissionLoaded,
  );
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionAccessBlocked, setSubmissionAccessBlocked] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("idle");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftLearnerId, setDraftLearnerId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const localDraftCacheKeyRef = useRef<string | null>(null);
  const latestAnswersRef = useRef<Record<string, string>>({});
  const latestQuestionIdsRef = useRef<string[]>([]);
  const latestActivityVersionRef = useRef<number | null>(null);
  const latestDraftRevisionRef = useRef(0);
  const hasDirtyLocalDraftRef = useRef(false);
  const isSavingDraftRef = useRef(false);
  const submissionSnapshot =
    submission && isActivitySubmissionSnapshot(submission.activity_snapshot)
      ? submission.activity_snapshot
      : null;
  const submittedTotalMarks =
    submission?.original_total_marks ??
    submissionSnapshot?.activity.totalMarks ??
    activityData?.activity.total_marks ??
    0;
  const returnedActivityPercentage =
    submission
      ? activityPercentage(
          submission.final_mark,
          submittedTotalMarks,
        )
      : null;
  const renderData =
    activityData ??
    (submissionSnapshot ? workspaceFromSnapshot(submissionSnapshot) : null);

  function applySavedSubmission(savedSubmission: SavedActivitySubmission) {
    setSubmission(savedSubmission);
    setAnswers(
      Object.fromEntries(
        savedSubmission.activity_submission_answers.map((answer) => [
          answer.question_id,
          answer.answer_text,
        ]),
      ),
    );
  }

  function readLocalDraftCache() {
    if (
      typeof window === "undefined" ||
      !localDraftCacheKeyRef.current
    ) {
      return null;
    }

    return parseLocalLearnerActivityDraftCache(
      window.localStorage.getItem(localDraftCacheKeyRef.current),
    );
  }

  const writeLocalDraftCache = useCallback(
    (input: {
      answers: Record<string, string>;
      revision?: number;
      activityVersion?: number;
      dirty: boolean;
      updatedAt?: string;
    }) => {
      if (
        typeof window === "undefined" ||
        !localDraftCacheKeyRef.current ||
        !draftLearnerId
      ) {
        return;
      }

      const activityVersion =
        input.activityVersion ?? latestActivityVersionRef.current ?? 0;
      if (activityVersion <= 0) return;

      const nextCache: LocalLearnerActivityDraftCache = {
        learnerId: draftLearnerId,
        subjectId: subject.databaseId,
        activityId,
        activityVersion,
        revision: input.revision ?? latestDraftRevisionRef.current,
        updatedAt: input.updatedAt ?? new Date().toISOString(),
        answers: reconcileAnswersForQuestionIds(
          latestQuestionIdsRef.current,
          input.answers,
        ),
        dirty: input.dirty,
      };

      window.localStorage.setItem(
        localDraftCacheKeyRef.current,
        JSON.stringify(nextCache),
      );
      hasDirtyLocalDraftRef.current = nextCache.dirty;
    },
    [activityId, draftLearnerId, subject.databaseId],
  );

  const clearLocalDraftCache = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      localDraftCacheKeyRef.current
    ) {
      window.localStorage.removeItem(localDraftCacheKeyRef.current);
    }
    hasDirtyLocalDraftRef.current = false;
  }, []);

  const saveDraft = useCallback(
    async (reason: "debounced" | "blur" | "visibility" | "before-submit") => {
      if (
        !activityData ||
        !draftLearnerId ||
        submission ||
        submissionAccessBlocked ||
        isSavingDraftRef.current
      ) {
        return false;
      }

      if (!navigator.onLine) {
        setDraftSaveState("offline");
        writeLocalDraftCache({
          answers: latestAnswersRef.current,
          dirty: true,
        });
        return false;
      }

      const normalizedAnswers = reconcileAnswersForQuestionIds(
        latestQuestionIdsRef.current,
        latestAnswersRef.current,
      );

      setDraftSaveState("saving");
      setDraftNotice("");
      isSavingDraftRef.current = true;

      try {
        const response = await fetch("/api/learner/activity-drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId,
            activityVersion:
              latestActivityVersionRef.current ?? activityData.activity.version,
            revision: latestDraftRevisionRef.current,
            answers: latestQuestionIdsRef.current.map((questionId) => ({
              questionId,
              answerText: normalizedAnswers[questionId] ?? "",
            })),
          }),
          keepalive: reason === "visibility",
        });

        const result = (await response.json()) as DraftApiResponse;

        if (!response.ok) {
          if (result.code === "DRAFT_REVISION_CONFLICT") {
            setDraftSaveState("newer-draft");
            setDraftNotice("A newer draft was found. Reload the activity to continue safely.");
            writeLocalDraftCache({
              answers: normalizedAnswers,
              dirty: true,
            });
            return false;
          }

          if (result.code === "ACTIVITY_UPDATED_RELOAD_REQUIRED") {
            setDraftSaveState("error");
            setDraftNotice(result.error ?? "This activity was updated. Reload before continuing.");
            writeLocalDraftCache({
              answers: normalizedAnswers,
              dirty: true,
            });
            return false;
          }

          throw new Error(result.error ?? "Unable to save draft");
        }

        if (result.draft) {
          latestDraftRevisionRef.current = result.draft.revision;
          writeLocalDraftCache({
            answers: normalizedAnswers,
            revision: result.draft.revision,
            activityVersion: result.draft.activityVersion,
            dirty: false,
            updatedAt: result.draft.updatedAt,
          });
        }

        setDraftSaveState("saved");
        return true;
      } catch (error) {
        console.error("Unable to save learner activity draft:", error);
        setDraftSaveState(
          navigator.onLine ? "error" : "offline",
        );
        setDraftNotice(
          navigator.onLine
            ? "Unable to save draft"
            : "Offline \u2014 saved on this device only",
        );
        writeLocalDraftCache({
          answers: normalizedAnswers,
          dirty: true,
        });
        return false;
      } finally {
        isSavingDraftRef.current = false;
      }
    },
    [
      activityData,
      activityId,
      draftLearnerId,
      submission,
      submissionAccessBlocked,
      writeLocalDraftCache,
    ],
  );

  const scheduleDraftSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveDraft("debounced");
    }, 2000);
  }, [saveDraft]);

  useEffect(() => {
    if (hasInitialActivityState) {
      return;
    }

    let isActive = true;

    async function loadActivity() {
      if (!activityId || !uuidPattern.test(activityId)) {
        if (isActive) {
          setPageState("invalid");
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setPageState(null);
        const result = await getLearnerActivityData(
          activityId,
          subject.databaseId,
        );

        if (!isActive) return;

        if (result.status === "success") {
          setActivityData(result.data);
        } else {
          setActivityData(null);
          setPageState(result.status);
        }
      } catch (error) {
        console.error(
          `Unable to load learner ${subject.displayName} activity:`,
          error,
        );
        if (isActive) {
          setActivityData(null);
          setPageState("error");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadActivity();

    return () => {
      isActive = false;
    };
  }, [activityId, hasInitialActivityState, subject.databaseId, subject.displayName]);

  useEffect(() => {
    if (initialSubmissionLoaded) {
      return;
    }

    let isActive = true;

    async function loadSubmission() {
      if (!activityId || !uuidPattern.test(activityId)) {
        if (isActive) setIsLoadingSubmission(false);
        return;
      }

      try {
        setIsLoadingSubmission(true);
        const response = await fetch(
          `/api/kingdom/mark-activity?activityId=${encodeURIComponent(activityId)}`,
        );
        const result = (await response.json()) as {
          submission?: SavedActivitySubmission | null;
          error?: string;
          code?: string;
        };

        if (!isActive) return;

        if (!response.ok) {
          setSubmissionAccessBlocked(true);
          setSubmissionMessage(
            result.error || "Unable to load your activity submission.",
          );
          return;
        }

        setSubmissionAccessBlocked(false);
        if (result.submission) applySavedSubmission(result.submission);
      } catch (error) {
        console.error("Unable to load saved activity submission:", error);
        if (isActive) {
          setSubmissionAccessBlocked(true);
          setSubmissionMessage("Unable to load your activity submission.");
        }
      } finally {
        if (isActive) setIsLoadingSubmission(false);
      }
    }

    loadSubmission();

    return () => {
      isActive = false;
    };
  }, [activityId, initialSubmissionLoaded]);

  useEffect(() => {
    if (!activityData) return;
    latestQuestionIdsRef.current = activityData.questions.map(
      (question) => question.id,
    );
    latestActivityVersionRef.current = activityData.activity.version;
  }, [activityData]);

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!activityData || isLoadingSubmission) return;

    if (submission) return;

    let isActive = true;

    async function loadDraft() {
      const currentActivityData = activityData;
      if (!currentActivityData) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        setIsLoadingDraft(true);
        const response = await fetch(
          `/api/learner/activity-drafts?activityId=${encodeURIComponent(activityId)}`,
        );
        const result = (await response.json()) as DraftApiResponse;

        if (!isActive) return;

        if (!response.ok) {
          if (
            result.code === "ALREADY_SUBMITTED" ||
            result.code === "UNAUTHORIZED"
          ) {
            return;
          }

          setDraftSaveState("error");
          setDraftNotice(result.error ?? "Unable to load activity draft");
          return;
        }

        setDraftLearnerId(result.learnerId);
        const cacheKey = buildActivityDraftCacheKey({
          learnerId: result.learnerId,
          subjectId: subject.databaseId,
          activityId,
        });
        localDraftCacheKeyRef.current = cacheKey;

        const localDraft = readLocalDraftCache();
        const serverDraft = result.draft;
        const currentQuestionIds = currentActivityData.questions.map(
          (question) => question.id,
        );

        let nextAnswers: Record<string, string> = {};
        let nextRevision = 0;

        const preferred = choosePreferredDraftSource({
          serverDraft,
          localDraft,
        });

        if (
          serverDraft &&
          serverDraft.activityVersion !== currentActivityData.activity.version
        ) {
          setDraftNotice(
            "This activity was updated by your teacher. Review your restored answers before submitting.",
          );
        }
        if (
          localDraft &&
          localDraft.activityVersion !== currentActivityData.activity.version
        ) {
          setDraftNotice(
            "This activity was updated by your teacher. Review your restored answers before submitting.",
          );
        }

        if (preferred.newerDraftFound) {
          setDraftSaveState("newer-draft");
        }

        if (preferred.winner === "server" && serverDraft) {
          nextAnswers = reconcileAnswersForQuestionIds(
            currentQuestionIds,
            answersRecordFromDraft(serverDraft.answers),
          );
          nextRevision = serverDraft.revision;
          writeLocalDraftCache({
            answers: nextAnswers,
            revision: serverDraft.revision,
            activityVersion: serverDraft.activityVersion,
            dirty: false,
            updatedAt: serverDraft.updatedAt,
          });
        } else if (preferred.winner === "local" && localDraft) {
          nextAnswers = reconcileAnswersForQuestionIds(
            currentQuestionIds,
            localDraft.answers,
          );
          nextRevision = localDraft.revision;
          if (localDraft.dirty) {
            setDraftSaveState(navigator.onLine ? "saving" : "offline");
            scheduleDraftSave();
          } else if (!serverDraft) {
            setDraftSaveState("saved");
          }
        }

        latestDraftRevisionRef.current = nextRevision;
        setAnswers(nextAnswers);
      } catch (error) {
        console.error("Unable to hydrate learner activity draft:", error);
        if (isActive) {
          setDraftSaveState("error");
          setDraftNotice("Unable to load activity draft");
        }
      } finally {
        if (isActive) setIsLoadingDraft(false);
      }
    }

    void loadDraft();

    return () => {
      isActive = false;
    };
  }, [
    activityData,
    activityId,
    isLoadingSubmission,
    scheduleDraftSave,
    submission,
    subject.databaseId,
    writeLocalDraftCache,
  ]);

  useEffect(() => {
    function flushOnHidden() {
      if (document.visibilityState === "hidden") {
        void saveDraft("visibility");
      }
    }

    function markOfflineState() {
      setDraftSaveState("offline");
      setDraftNotice("Offline \u2014 saved on this device only");
    }

    function clearOfflineState() {
      if (hasDirtyLocalDraftRef.current) {
        void saveDraft("visibility");
      }
    }

    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("offline", markOfflineState);
    window.addEventListener("online", clearOfflineState);

    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("offline", markOfflineState);
      window.removeEventListener("online", clearOfflineState);
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveDraft]);

  async function submitActivity() {
    if (!activityData || submission || isSubmitting) return;

    const hasBlankAnswer = activityData.questions.some(
      (question) => !answers[question.id]?.trim(),
    );

    if (hasBlankAnswer) {
      setSubmissionMessage("Please answer every question before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmissionMessage("");
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      await saveDraft("before-submit");
      const response = await fetch("/api/kingdom/mark-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          activityVersion: activityData.activity.version,
          answers: activityData.questions.map((question) => ({
            questionId: question.id,
            answerText: answers[question.id].trim(),
          })),
        }),
      });
      const result = (await response.json()) as {
        submission?: SavedActivitySubmission | null;
        error?: string;
        saved?: boolean;
        code?: string;
      };

      if (result.submission) applySavedSubmission(result.submission);
      if (result.submission) {
        clearLocalDraftCache();
        setDraftSaveState("idle");
        setDraftNotice("");
      }

      if (!response.ok) {
        if (result.code === "UNAUTHORIZED") setSubmissionAccessBlocked(true);
        if (result.code === "ACTIVITY_UPDATED_RELOAD_REQUIRED") {
          setSubmissionAccessBlocked(true);
        }
        throw new Error(
          result.error ||
            (result.saved
              ? "Your activity was saved, but marking is still pending."
              : "Unable to submit the activity."),
        );
      }

      setSubmissionMessage("");
    } catch (error) {
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit the activity.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || (!activityData && isLoadingSubmission) || (!submission && activityData && isLoadingDraft)) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 lg:px-8`}
        style={themeStyle}
      >
          <div className="mx-auto w-full max-w-md rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-sm text-slate-500 shadow-sm lg:max-w-3xl">
          Loading activity...
          </div>
        </main>
      );
  }

  if ((pageState || !activityData) && !renderData) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 lg:px-8`}
        style={themeStyle}
      >
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:max-w-3xl">
          <Link
            href={buildSubjectRoute(subject, "learnerActivities")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]"
          >
            <ArrowLeft size={16} /> Back to Activities
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Activity unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {activityStateMessages[pageState ?? "error"]}
          </p>
        </div>
      </main>
    );
  }

  if (!renderData) return null;

  const { activity, reading, lesson, questions } = renderData;
  const displayedActivity = submissionSnapshot
    ? {
        ...activity,
        id: submissionSnapshot.activity.id,
        version: submissionSnapshot.activity.version,
        title: submissionSnapshot.activity.title,
        instructions: submissionSnapshot.activity.instructions,
        total_marks: submissionSnapshot.activity.totalMarks,
        due_date: submissionSnapshot.activity.dueDate,
      }
    : activity;
  const displayedReading = submissionSnapshot
    ? {
        ...reading,
        id: submissionSnapshot.reading.id,
        title: submissionSnapshot.reading.title,
        content_text: submissionSnapshot.reading.contentText,
      }
    : reading;
  const displayedLesson = submissionSnapshot
    ? {
        ...lesson,
        id: submissionSnapshot.lesson.id,
        title: submissionSnapshot.lesson.title,
        lesson_number: submissionSnapshot.lesson.lessonNumber,
        term_number: submissionSnapshot.lesson.termNumber,
        week_number: submissionSnapshot.lesson.weekNumber,
      }
    : lesson;
  const displayedQuestions = submissionSnapshot
    ? submissionSnapshot.questions.map((question) => ({
        id: question.id,
        question_number: question.questionNumber,
        question_text: question.questionText,
        question_type: question.questionType,
        marks: question.marks,
        assessment_objective: question.assessmentObjective,
        guidance: question.guidance,
        display_order: question.displayOrder,
      }))
    : questions;
  const hasSchedule =
    displayedLesson.term_number !== null &&
    displayedLesson.week_number !== null;
  const activitiesHref = buildSubjectRoute(subject, "learnerActivities");

  return (
    <main
      className={`${neueHaas.className} min-h-screen w-full overflow-x-clip bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12 lg:px-8`}
      style={themeStyle}
    >
      <div className="mx-auto w-full min-w-0 max-w-md space-y-5 lg:max-w-6xl lg:space-y-8">
        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-6">
          <Link
            href={activitiesHref}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]"
          >
            <ArrowLeft size={16} /> Back to Activities
          </Link>
          <h1 className="break-words text-3xl font-bold text-slate-900">
            {displayedActivity.title}
          </h1>
          <p className="mt-1 break-words text-lg font-semibold text-slate-700">
            Lesson {displayedLesson.lesson_number} &mdash;{" "}
            {displayedLesson.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
            {hasSchedule && (
              <span>Week {displayedLesson.week_number} &middot; Term {displayedLesson.term_number}</span>
            )}
            <span>{displayedActivity.total_marks} marks</span>
            {displayedActivity.due_date && (
              <span className="inline-flex items-center gap-1 text-[var(--subject-primary)]">
                <Clock size={14} />
                Due{" "}
                {new Date(displayedActivity.due_date).toLocaleDateString("en-ZA", {
                  timeZone: "UTC",
                })}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {subject.displayName} Activity Workspace
          </p>
        </section>

        {isDevelopment && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 lg:mx-auto lg:max-w-4xl">
            Development testing mode: activity submissions are being recorded
            against the configured test learner.
          </p>
        )}

        {subjectKey === "business-studies" && (
        <section className="w-full min-w-0 overflow-hidden rounded-[2rem] border border-[var(--subject-border)] bg-black shadow-sm lg:mx-auto lg:max-w-5xl">
          <Image
            src="/kingdom-business-studies.png"
            alt="Business Studies activity"
            width={1400}
            height={1050}
            priority
            className="h-auto w-full object-contain"
          />
        </section>
        )}

        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:mx-auto lg:max-w-3xl lg:p-6">
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-orange-50 p-3">
              <BookOpen className="text-[var(--subject-primary)]" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-slate-900">
                {displayedReading.title}
              </h2>
              <p className="break-words text-sm text-slate-500">
                Reading Reference: Lesson {displayedLesson.lesson_number}
              </p>
            </div>
          </div>
          <ProtectedReading content={displayedReading.content_text} scrollable />
        </section>

        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:mx-auto lg:max-w-4xl lg:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-orange-50 p-3">
              <SquarePen className="text-[var(--subject-primary)]" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Activity Questions
              </h2>
              {displayedActivity.instructions && (
                <p className="text-sm text-slate-500">
                  {displayedActivity.instructions}
                </p>
              )}
              {submissionSnapshot && (
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Activity version completed: Version{" "}
                  {submissionSnapshot.activity.version}
                </p>
              )}
            </div>
          </div>

          {displayedQuestions.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No questions are available for this activity.
            </p>
          ) : (
            <div className="w-full min-w-0 space-y-4">
              {displayedQuestions.map((question) => (
                <div
                  key={question.id}
                  className="w-full min-w-0 rounded-2xl bg-slate-50 p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h3 className="min-w-0 font-bold text-slate-900">
                      Question {question.question_number}
                    </h3>
                    <span className="shrink-0 text-xs font-semibold text-[var(--subject-primary)]">
                      {question.marks}{" "}
                      {question.marks === 1 ? "mark" : "marks"}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
                    {question.question_text}
                  </p>
                  {question.assessment_objective && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--subject-primary)]">
                      {question.assessment_objective}
                    </p>
                  )}
                  <textarea
                    disabled={Boolean(submission) || isSubmitting}
                    value={answers[question.id] ?? ""}
                    onChange={(event) => {
                      const nextAnswers = {
                        ...latestAnswersRef.current,
                        [question.id]: event.target.value,
                      };
                      latestAnswersRef.current = nextAnswers;
                      setAnswers(nextAnswers);
                      writeLocalDraftCache({
                        answers: nextAnswers,
                        dirty: true,
                      });
                      setDraftSaveState(
                        navigator.onLine ? "saving" : "offline",
                      );
                      setSubmissionMessage("");
                      setDraftNotice(
                        navigator.onLine ? "" : "Offline \u2014 saved on this device only",
                      );
                      scheduleDraftSave();
                    }}
                    onBlur={() => {
                      void saveDraft("blur");
                    }}
                    placeholder="Type your answer here..."
                    className="mt-3 min-h-[120px] w-full max-w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[var(--subject-primary)] disabled:bg-slate-100 lg:min-h-[144px]"
                  />
                  {submission?.activity_submission_answers.find(
                    (answer) => answer.question_id === question.id,
                  )?.kingdom_feedback && (() => {
                    const savedAnswer =
                      submission.activity_submission_answers.find(
                        (answer) => answer.question_id === question.id,
                      )!;

                    return (
                      <div className="mt-3 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
                        <p className="font-bold text-orange-600">
                          Kingdom: {savedAnswer.kingdom_mark}/{question.marks}
                        </p>
                        <p className="mt-1">{savedAnswer.kingdom_feedback}</p>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>

        {submission?.status === "awaiting_review" && (
          <section className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 text-center shadow-sm lg:mx-auto lg:max-w-4xl lg:p-6">
            <h2 className="text-xl font-bold text-slate-900">
              Preliminary Kingdom Assessment
            </h2>
            <p className="mt-4 text-2xl font-bold text-[var(--subject-primary)]">
              Preliminary mark: {submission.preliminary_mark}/
              {submission.preliminary_total}
            </p>
            <p className="mt-1 font-semibold text-slate-700">
              Percentage: {submission.preliminary_percentage}%
            </p>
            <p className="mt-3 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800">
              Status: Awaiting Teacher Review
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This result is preliminary and may change after your teacher
              reviews your work.
            </p>
          </section>
        )}

        {submission && submission.status !== "awaiting_review" && (
          <section className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:mx-auto lg:max-w-4xl lg:p-6">
            <h2 className="text-xl font-bold text-slate-900">
              Activity Submitted
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {submission.status === "marking_failed"
                ? "Your answers are saved. Preliminary marking could not be completed yet."
                : submission.status === "returned"
                  ? "Your teacher has returned this activity. Final-result details will be added in a later step."
                  : "Your answers are saved and preliminary marking is in progress."}
            </p>
            {submission.status === "returned" && (
              <div className="mt-4 rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                  Activity Mark
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {submission.final_mark ?? "\u2014"}/
                  {submittedTotalMarks}
                </p>
                <p className="mt-1 font-bold text-orange-600">
                  {returnedActivityPercentage === null
                    ? "Percentage unavailable"
                    : `Percentage: ${returnedActivityPercentage}%`}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Included in the Activity Performance component of your
                  Overall Mark
                </p>
              </div>
            )}
          </section>
        )}

        {submission && (
          <Link
            href={activitiesHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--subject-border)] bg-white py-4 font-bold text-[var(--subject-primary)] shadow-sm lg:mx-auto lg:max-w-4xl"
          >
            <ArrowLeft size={18} />
            Back to Activities
          </Link>
        )}

        {!submission && (
          <>
          <p className="text-center text-xs font-semibold text-slate-500 lg:mx-auto lg:max-w-4xl">
            {draftSaveState === "saving"
              ? "Saving..."
              : draftSaveState === "saved"
                ? "Draft saved"
                : draftSaveState === "error"
                  ? "Unable to save draft"
                  : draftSaveState === "offline"
                    ? "Offline \u2014 saved on this device only"
                    : draftSaveState === "newer-draft"
                      ? "A newer draft was found"
                      : "Draft saved automatically"}
          </p>
          <button
            type="button"
            onClick={submitActivity}
            disabled={
              isSubmitting || isLoadingSubmission || submissionAccessBlocked
            }
            className="w-full rounded-2xl bg-[var(--subject-primary)] py-4 text-lg font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 lg:mx-auto lg:block lg:max-w-4xl"
          >
            {isSubmitting ? "Submitting..." : "Submit Activity"}
          </button>
          </>
        )}
        {isLoadingSubmission && (
          <p className="text-center text-xs text-slate-500 lg:mx-auto lg:max-w-4xl">
            Checking submission status...
          </p>
        )}
        {submissionMessage && (
          <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 lg:mx-auto lg:max-w-4xl">
            {submissionMessage}
          </p>
        )}
        {!submission && draftNotice && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 lg:mx-auto lg:max-w-4xl">
            {draftNotice}
          </p>
        )}
      </div>
    </main>
  );
}

export default function BusinessStudiesActivityPage() {
  return <SubjectActivityPage />;
}
