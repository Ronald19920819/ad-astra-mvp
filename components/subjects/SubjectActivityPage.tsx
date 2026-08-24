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
import { ProtectedPdfReading } from "@/components/learners/ProtectedPdfReading";
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
import { formatSubjectTeacherLabel } from "@/lib/subjects/subjectTeacherPresentation";
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
      source_type: "pasted_text",
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

function isLifecycleSaveReason(
  reason: "debounced" | "blur" | "visibility" | "pagehide" | "before-submit",
) {
  return reason === "visibility" || reason === "pagehide";
}

function isLikelyLifecycleFetchTermination(error: unknown) {
  return error instanceof TypeError && /failed to fetch/i.test(error.message);
}


export function SubjectActivityPage({
  subjectKey = "business-studies",
  initialActivityData,
  initialActivityState,
  initialSubmission,
  initialSubmissionLoaded = false,
  initialTeacherNames,
}: {
  subjectKey?: SubjectKey;
  initialActivityData?: LearnerActivityWorkspaceData | null;
  initialActivityState?: ActivityState | null;
  initialSubmission?: SavedActivitySubmission | null;
  initialSubmissionLoaded?: boolean;
  initialTeacherNames?: string[];
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [pasteBlockedNoticeVisible, setPasteBlockedNoticeVisible] = useState(false);
  const pasteBlockedNoticeTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const localDraftCacheKeyRef = useRef<string | null>(null);
  const latestAnswersRef = useRef<Record<string, string>>({});
  const latestQuestionIdsRef = useRef<string[]>([]);
  const latestActivityVersionRef = useRef<number | null>(null);
  const latestDraftRevisionRef = useRef(0);
  const hasDirtyLocalDraftRef = useRef(false);
  const isSavingDraftRef = useRef(false);
  const lastConfirmedDraftPayloadRef = useRef<string | null>(null);
  const pendingLifecycleDraftPayloadRef = useRef<string | null>(null);
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
  const teacherLabel = formatSubjectTeacherLabel(initialTeacherNames);
  const renderData =
    activityData ??
    (submissionSnapshot ? workspaceFromSnapshot(submissionSnapshot) : null);
  const activeQuestionCount = renderData?.questions.length ?? 0;
  const canonicalActivityId = activityData?.activity.id ?? initialActivityData?.activity.id ?? null;

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

  useEffect(() => {
    if (hasInitialActivityState) {
      return;
    }

    if (!uuidPattern.test(activityId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageState("invalid");
      setActivityData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadActivity() {
      try {
        setIsLoading(true);
        const result = await getLearnerActivityData(activityId, subject.databaseId);
        if (cancelled) return;

        if (result.status === "success") {
          setActivityData(result.data);
          setPageState(null);
        } else {
          setActivityData(null);
          setPageState(result.status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`Unable to load learner ${subject.displayName} activity:`, error);
          setActivityData(null);
          setPageState("error");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [
    activityId,
    hasInitialActivityState,
    subject.databaseId,
    subject.displayName,
  ]);

  useEffect(() => {
    if (!activityData) {
      latestQuestionIdsRef.current = [];
      latestActivityVersionRef.current = null;
      latestAnswersRef.current = {};
      return;
    }

    const nextQuestionIds = activityData.questions.map((question) => question.id);
    const nextAnswers = reconcileAnswersForQuestionIds(
      nextQuestionIds,
      latestAnswersRef.current,
    );

    latestQuestionIdsRef.current = nextQuestionIds;
    latestActivityVersionRef.current = activityData.activity.version;
    latestAnswersRef.current = nextAnswers;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentQuestionIndex((currentIndex) =>
      nextQuestionIds.length === 0
        ? 0
        : Math.min(currentIndex, nextQuestionIds.length - 1),
    );
  }, [activityData]);

  useEffect(() => {
    if (!activityData || !canonicalActivityId || submission) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingDraft(false);
      return;
    }

    const draftActivityId = canonicalActivityId;
    const currentActivity = activityData;
    let cancelled = false;

    async function loadDraft() {
      setIsLoadingDraft(true);

      try {
        const response = await fetch(
          "/api/learner/activity-drafts?activityId=" +
            encodeURIComponent(draftActivityId),
          { cache: "no-store" },
        );
        const result = (await response.json()) as DraftApiResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load activity draft");
        }

        if (cancelled) return;

        setDraftLearnerId(result.learnerId);
        localDraftCacheKeyRef.current = buildActivityDraftCacheKey({
          learnerId: result.learnerId,
          subjectId: subject.databaseId,
          activityId: draftActivityId,
        });

        const currentActivityVersion = currentActivity.activity.version;
        const localDraft = parseLocalLearnerActivityDraftCache(
          typeof window === "undefined" || !localDraftCacheKeyRef.current
            ? null
            : window.localStorage.getItem(localDraftCacheKeyRef.current),
        );
        const validLocalDraft =
          localDraft && localDraft.activityVersion === currentActivityVersion
            ? localDraft
            : null;
        const validServerDraft =
          result.draft && result.draft.activityVersion === currentActivityVersion
            ? result.draft
            : null;
        const preferredDraft = choosePreferredDraftSource({
          serverDraft: validServerDraft,
          localDraft: validLocalDraft,
        });

        let nextAnswers: Record<string, string> = {};
        let nextRevision = 0;
        let nextUpdatedAt: string | undefined;

        if (preferredDraft.winner === "server" && validServerDraft) {
          nextAnswers = reconcileAnswersForQuestionIds(
            latestQuestionIdsRef.current,
            answersRecordFromDraft(validServerDraft.answers),
          );
          nextRevision = validServerDraft.revision;
          nextUpdatedAt = validServerDraft.updatedAt;
        } else if (preferredDraft.winner === "local" && validLocalDraft) {
          nextAnswers = reconcileAnswersForQuestionIds(
            latestQuestionIdsRef.current,
            validLocalDraft.answers,
          );
          nextRevision = validLocalDraft.revision;
          nextUpdatedAt = validLocalDraft.updatedAt;
        }

        latestDraftRevisionRef.current = nextRevision;
        latestAnswersRef.current = nextAnswers;
        lastConfirmedDraftPayloadRef.current = null;
        pendingLifecycleDraftPayloadRef.current = null;
        hasDirtyLocalDraftRef.current =
          preferredDraft.winner === "local" && Boolean(validLocalDraft?.dirty);

        setAnswers(nextAnswers);
        setDraftSaveState(preferredDraft.winner === "none" ? "idle" : "saved");
        setDraftNotice(
          preferredDraft.newerDraftFound
            ? "A newer draft was restored."
            : "",
        );

        if (
          preferredDraft.winner !== "none" &&
          typeof window !== "undefined" &&
          localDraftCacheKeyRef.current
        ) {
          const nextCache: LocalLearnerActivityDraftCache = {
            learnerId: result.learnerId,
            subjectId: subject.databaseId,
            activityId: draftActivityId,
            activityVersion: currentActivityVersion,
            revision: nextRevision,
            updatedAt: nextUpdatedAt ?? new Date().toISOString(),
            answers: nextAnswers,
            dirty: false,
          };

          window.localStorage.setItem(
            localDraftCacheKeyRef.current,
            JSON.stringify(nextCache),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load learner activity draft:", error);
          setDraftSaveState("error");
          setDraftNotice("Unable to load draft");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDraft(false);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [
    activityData,
    canonicalActivityId,
    submission,
    subject.databaseId,
  ]);

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
    async (reason: "debounced" | "blur" | "visibility" | "pagehide" | "before-submit") => {
      const lifecycleSave = isLifecycleSaveReason(reason);

      if (
        !activityData ||
        !draftLearnerId ||
        submission ||
        submissionAccessBlocked ||
        (!lifecycleSave && isSavingDraftRef.current)
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
      const payload = {
        activityId,
        activityVersion:
          latestActivityVersionRef.current ?? activityData.activity.version,
        revision: latestDraftRevisionRef.current,
        answers: latestQuestionIdsRef.current.map((questionId) => ({
          questionId,
          answerText: normalizedAnswers[questionId] ?? "",
        })),
      };
      const payloadKey = JSON.stringify(payload);

      if (payloadKey === lastConfirmedDraftPayloadRef.current) {
        setDraftSaveState("saved");
        return true;
      }

      if (lifecycleSave) {
        if (
          payloadKey === pendingLifecycleDraftPayloadRef.current ||
          isSavingDraftRef.current
        ) {
          return true;
        }

        pendingLifecycleDraftPayloadRef.current = payloadKey;

        try {
          void fetch("/api/learner/activity-drafts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: payloadKey,
            keepalive: true,
          }).catch((error) => {
            if (!isLikelyLifecycleFetchTermination(error)) {
              console.error("Unable to dispatch learner activity draft save:", error);
            }
          });

          return true;
        } catch (error) {
          if (!isLikelyLifecycleFetchTermination(error)) {
            console.error("Unable to dispatch learner activity draft save:", error);
            setDraftSaveState(navigator.onLine ? "error" : "offline");
            setDraftNotice(
              navigator.onLine
                ? "Unable to save draft"
                : "Offline ? saved on this device only",
            );
          }

          writeLocalDraftCache({
            answers: normalizedAnswers,
            dirty: true,
          });
          return false;
        }
      }

      setDraftSaveState("saving");
      setDraftNotice("");
      isSavingDraftRef.current = true;

      try {
        const response = await fetch("/api/learner/activity-drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payloadKey,
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
          lastConfirmedDraftPayloadRef.current = payloadKey;
          pendingLifecycleDraftPayloadRef.current = null;
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
            : "Offline ? saved on this device only",
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

  const reconcileLifecycleDraft = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !pendingLifecycleDraftPayloadRef.current ||
      !canonicalActivityId ||
      !draftLearnerId ||
      !navigator.onLine ||
      submission ||
      submissionAccessBlocked
    ) {
      return;
    }

    const draftActivityId = canonicalActivityId;

    try {
      const response = await fetch(
        "/api/learner/activity-drafts?activityId=" + encodeURIComponent(draftActivityId),
      );
      const result = (await response.json()) as DraftApiResponse;

      if (!response.ok || !result.draft) {
        return;
      }

      const serverAnswers = reconcileAnswersForQuestionIds(
        latestQuestionIdsRef.current,
        answersRecordFromDraft(result.draft.answers),
      );
      const localAnswers = reconcileAnswersForQuestionIds(
        latestQuestionIdsRef.current,
        latestAnswersRef.current,
      );

      if (JSON.stringify(serverAnswers) !== JSON.stringify(localAnswers)) {
        return;
      }

      latestDraftRevisionRef.current = result.draft.revision;
      lastConfirmedDraftPayloadRef.current = pendingLifecycleDraftPayloadRef.current;
      pendingLifecycleDraftPayloadRef.current = null;
      writeLocalDraftCache({
        answers: localAnswers,
        revision: result.draft.revision,
        activityVersion: result.draft.activityVersion,
        dirty: false,
        updatedAt: result.draft.updatedAt,
      });
      setDraftSaveState("saved");
      setDraftNotice("");
    } catch (error) {
      console.error("Unable to reconcile learner activity draft:", error);
    }
  }, [
    activityId,
    draftLearnerId,
    submission,
    submissionAccessBlocked,
    writeLocalDraftCache,
  ]);

  const scheduleDraftSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveDraft("debounced");
    }, 2000);
  }, [saveDraft]);

  useEffect(() => {
    function flushOnHidden() {
      if (document.visibilityState === "hidden") {
        void saveDraft("visibility");
        return;
      }

      void reconcileLifecycleDraft();
    }

    function flushOnPageHide() {
      void saveDraft("pagehide");
    }

    function markOfflineState() {
      setDraftSaveState("offline");
      setDraftNotice("Offline — saved on this device only");
    }

    function clearOfflineState() {
      if (hasDirtyLocalDraftRef.current) {
        void saveDraft("visibility");
      }
    }

    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    window.addEventListener("offline", markOfflineState);
    window.addEventListener("online", clearOfflineState);

    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
      window.removeEventListener("offline", markOfflineState);
      window.removeEventListener("online", clearOfflineState);
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [reconcileLifecycleDraft, saveDraft]);

  useEffect(() => {
    return () => {
      if (pasteBlockedNoticeTimeoutRef.current !== null) {
        window.clearTimeout(pasteBlockedNoticeTimeoutRef.current);
      }
    };
  }, []);

  // Reward-integrity safeguard: learner activity answers must be typed, not
  // pasted from an external source. This hooks the answer's own `paste`
  // event -- the one event every paste trigger (Ctrl+V, Cmd+V,
  // right-click/context-menu Paste, mobile long-press Paste) ultimately
  // fires on the target element, so blocking it here is reliable without
  // needing separate keyboard-shortcut interception. `onDrop` is blocked
  // too, since dragging text in is another way to insert external content
  // that bypasses `paste` entirely. This never touches `onChange`/React
  // state updates, so a future first-party input method (e.g. speech
  // transcription writing directly into `answers` state) is entirely
  // unaffected -- only clipboard/drag-sourced insertion is blocked.
  // Copy/cut of the learner's own typed text is deliberately left alone
  // (untouched by these handlers); pasting it back is still blocked like
  // any other paste, since reliably distinguishing "the learner's own
  // recently-copied text" from external text would require fragile,
  // privacy-invasive clipboard tracking that was explicitly out of scope.
  function blockExternalAnswerInput(
    event: React.ClipboardEvent<HTMLTextAreaElement> | React.DragEvent<HTMLTextAreaElement>,
  ) {
    event.preventDefault();
    setPasteBlockedNoticeVisible(true);
    if (pasteBlockedNoticeTimeoutRef.current !== null) {
      window.clearTimeout(pasteBlockedNoticeTimeoutRef.current);
    }
    pasteBlockedNoticeTimeoutRef.current = window.setTimeout(() => {
      setPasteBlockedNoticeVisible(false);
    }, 4000);
  }

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
        source_type: "pasted_text" as const,
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
  const safeCurrentQuestionIndex =
    activeQuestionCount <= 0
      ? 0
      : Math.min(currentQuestionIndex, activeQuestionCount - 1);
  const activeQuestion = displayedQuestions[safeCurrentQuestionIndex] ?? null;
  const activeSavedAnswer = activeQuestion
    ? submission?.activity_submission_answers.find(
        (answer) => answer.question_id === activeQuestion.id,
      ) ?? null
    : null;

  return (
    <main
      className={`${neueHaas.className} min-h-screen w-full overflow-x-clip bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12 lg:px-8`}
      style={themeStyle}
    >
      <div className="mx-auto w-full min-w-0 max-w-md space-y-5 lg:max-w-7xl lg:space-y-8 xl:max-w-[1400px]">
        <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:flex lg:h-full lg:flex-col lg:p-6">
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
          <p className="mt-2 break-words text-sm text-slate-500">
            {subject.displayName} Activity Workspace &middot; {teacherLabel}
          </p>
        </section>

        {isDevelopment && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 lg:mx-auto lg:max-w-4xl">
            Development testing mode: activity submissions are being recorded
            against the configured test learner.
          </p>
        )}

        {subject.activityBannerSrc && (
        <section className="w-full min-w-0 overflow-hidden rounded-[2rem] border border-[var(--subject-border)] bg-black shadow-sm lg:mx-auto lg:max-w-6xl">
          <Image
            src={subject.activityBannerSrc}
            alt={`${subject.displayName} activity`}
            width={1400}
            height={1050}
            priority
            className="h-[180px] w-full object-cover object-top sm:h-[210px] lg:h-[220px] xl:h-[240px]"
          />
        </section>
        )}

        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(360px,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 xl:grid-cols-[minmax(0,1.7fr)_minmax(420px,1fr)]">
          <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:flex lg:h-full lg:flex-col lg:p-6">
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
            {displayedReading.source_type === "pdf" && !submissionSnapshot ? (
              <ProtectedPdfReading lessonId={displayedLesson.id} materialId={displayedReading.id} />
            ) : (
              <ProtectedReading content={displayedReading.content_text} scrollable />
            )}
          </section>

          <section className="w-full min-w-0 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:flex lg:h-full lg:flex-col lg:p-6">
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

            {displayedQuestions.length === 0 || !activeQuestion ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No questions are available for this activity.
              </p>
            ) : (
              <div className="w-full min-w-0 rounded-2xl bg-slate-50 p-4 lg:flex lg:h-full lg:min-h-[720px] lg:flex-1 lg:flex-col lg:overflow-y-auto">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="min-w-0 font-bold text-slate-900 font-sans">
                    Question {safeCurrentQuestionIndex + 1} of {displayedQuestions.length}
                  </h3>
                  <span className="shrink-0 text-xs font-semibold text-[var(--subject-primary)]">
                    {activeQuestion.marks}{" "}
                    {activeQuestion.marks === 1 ? "mark" : "marks"}
                  </span>
                </div>
                <p className="mt-2 break-words font-sans text-sm font-medium leading-6 text-slate-700">
                  {activeQuestion.question_text}
                </p>
                {activeQuestion.assessment_objective && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--subject-primary)]">
                    {activeQuestion.assessment_objective}
                  </p>
                )}
                <textarea
                  disabled={Boolean(submission) || isSubmitting}
                  value={answers[activeQuestion.id] ?? ""}
                  onChange={(event) => {
                    const nextAnswers = {
                      ...latestAnswersRef.current,
                      [activeQuestion.id]: event.target.value,
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
                  onPaste={blockExternalAnswerInput}
                  onDrop={blockExternalAnswerInput}
                  placeholder="Type your answer here..."
                  className="mt-3 min-h-[160px] w-full max-w-full rounded-2xl border border-slate-200 bg-white p-3 font-sans text-sm text-slate-900 outline-none focus:border-[var(--subject-primary)] disabled:bg-slate-100 lg:min-h-[320px] lg:flex-1"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Answer in your own words. Pasting is disabled for activity
                  responses.
                </p>
                {pasteBlockedNoticeVisible && (
                  <p
                    role="status"
                    className="mt-1.5 text-xs font-semibold text-amber-700"
                  >
                    Please type your answer yourself. Pasting is disabled for
                    activities.
                  </p>
                )}
                {activeSavedAnswer?.kingdom_feedback && (
                  <div className="mt-3 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
                    <p className="font-bold text-orange-600">
                      Kingdom: {activeSavedAnswer.kingdom_mark}/{activeQuestion.marks}
                    </p>
                    <p className="mt-1">{activeSavedAnswer.kingdom_feedback}</p>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIndex(Math.max(0, safeCurrentQuestionIndex - 1))
                    }
                    disabled={safeCurrentQuestionIndex === 0}
                    aria-label="Previous question"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {"\u2190"} Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIndex(Math.min(displayedQuestions.length - 1, safeCurrentQuestionIndex + 1))
                    }
                    disabled={safeCurrentQuestionIndex === displayedQuestions.length - 1}
                    aria-label="Next question"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next {"\u2192"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
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

