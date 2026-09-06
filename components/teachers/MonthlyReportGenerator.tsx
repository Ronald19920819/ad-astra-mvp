"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { neueHaas } from "@/app/fonts";
import { formatReportMonthLabel } from "@/lib/reports/monthlyReportMonth";
import type { SubjectEnrolledLearner } from "@/lib/reports/monthlyReportCatalog";
import type { MonthlyReportRow } from "@/lib/reports/monthlyReportRepository";
import {
  resolveDisplayedMonthlyReportComments,
  type KingdomMonthlyReportComments,
  type StoredMonthlyReportKingdomComments,
  type StoredMonthlyReportTeacherEditedComments,
} from "@/lib/reports/kingdomMonthlyReport";
import { hashMonthlyReportSnapshot } from "@/lib/reports/monthlyReportSnapshotHash";
import {
  deriveCommentaryFreshness,
  MonthlyReportFinaliseStatus,
} from "@/components/teachers/MonthlyReportFinaliseStatus";
import { MonthlyReportDelivery } from "@/components/teachers/MonthlyReportDelivery";
import { resolveMonthlyReportBadgeAsset } from "@/lib/reports/monthlyReportBadgeAsset";
import type {
  MonthlyReportAcademic,
  MonthlyReportActivityEntry,
  MonthlyReportLessonEntry,
  MonthlyReportPayload,
} from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2: the teacher report
// generator. This component performs NO report calculations itself -- it
// is a pure consumer of the Stage 1 deterministic engine via
// app/api/teacher/reports/*. Every lesson/activity status, rate,
// evidence flag, and badge shown here is exactly what that engine
// computed; nothing is derived or re-interpreted in React.

type ReportSubjectOption = {
  key: string;
  databaseId: string;
  displayName: string;
  colourTheme: { primary: string; softBackground: string; border: string };
};

export function lessonStatusLabel(status: MonthlyReportLessonEntry["status"]) {
  switch (status) {
    case "Complete":
      return "Complete";
    case "Late":
      return "Completed Late";
    case "Overdue":
      return "Overdue";
    case "Incomplete":
      return "Not Yet Due";
  }
}

export function lessonStatusTone(status: MonthlyReportLessonEntry["status"]) {
  if (status === "Complete") return "bg-green-100 text-green-700";
  if (status === "Late") return "bg-amber-100 text-amber-700";
  if (status === "Overdue") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

export function activityStatusLabel(activity: MonthlyReportActivityEntry) {
  if (activity.submissionStatus === "not_submitted") {
    return activity.isOverdue ? "Outstanding (Overdue)" : "Outstanding";
  }
  const base =
    activity.submissionStatus === "returned"
      ? "Returned"
      : activity.submissionStatus === "awaiting_review"
        ? "Awaiting Review"
        : "Submitted";
  return activity.isLate ? `${base} (Late)` : base;
}

export function activityStatusTone(activity: MonthlyReportActivityEntry) {
  if (activity.submissionStatus === "not_submitted") {
    return activity.isOverdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";
  }
  if (activity.isLate) return "bg-amber-100 text-amber-700";
  if (activity.submissionStatus === "awaiting_review") return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

export function formatDueDate(dueDate: string | null) {
  if (!dueDate) return "No due date";
  return new Date(`${dueDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function formatRate(value: number | null) {
  return value === null ? "No selected items" : `${Math.round(value * 100)}%`;
}

// "On-Time Work" is deliberately a volume (X of Y), never a percentage --
// a rate here can look artificially high when almost everything selected
// is actually overdue and missing (e.g. 1 on-time submission out of 10
// due items would otherwise read as "100%" if the one submitted item
// happened to be on time). Y === 0 means nothing selected was actually
// due yet, which is a genuinely different state from "0 due items were
// on time" -- shown as a neutral message rather than a confusing "0 / 0".
export function formatOnTimeWork(completedCount: number, dueCount: number) {
  return dueCount === 0 ? "No work due yet" : `${completedCount} / ${dueCount}`;
}

// The academic average is an equal-weight mean over the "effective" slots
// only (returned + overdue-missing) -- awaiting-review and not-yet-due
// activities stay visible in the report but are excluded from the
// denominator so they can neither help nor hurt the learner. This text
// makes that arithmetic legible to the teacher reading the preview.
export function academicBasisSummary(academic: MonthlyReportAcademic): string {
  const {
    selectedActivityCount,
    effectiveActivityCount,
    returnedActivityCount,
    overdueMissingActivityCount,
    awaitingReviewActivityCount,
    notYetDueActivityCount,
    academicPercentage,
  } = academic;

  if (academicPercentage === null) {
    return "No academic result yet -- none of the selected activities have been reviewed or are overdue.";
  }

  const exclusions: string[] = [];
  if (awaitingReviewActivityCount > 0) {
    exclusions.push(`${awaitingReviewActivityCount} awaiting review`);
  }
  if (notYetDueActivityCount > 0) {
    exclusions.push(`${notYetDueActivityCount} not yet due`);
  }

  let summary = `Based on ${effectiveActivityCount} due report ${effectiveActivityCount === 1 ? "activity" : "activities"} out of ${selectedActivityCount} selected: ${returnedActivityCount} reviewed, ${overdueMissingActivityCount} overdue and unsubmitted.`;
  if (exclusions.length > 0) {
    summary += ` (${exclusions.join(", ")} excluded from this result.)`;
  }
  return summary;
}

export function MonthlyReportGenerator({ subjects }: { subjects: ReportSubjectOption[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.databaseId ?? "");
  const [reportMonthInput, setReportMonthInput] = useState("");

  const [learners, setLearners] = useState<SubjectEnrolledLearner[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnerProfileId, setLearnerProfileId] = useState("");

  const [catalog, setCatalog] = useState<MonthlyReportPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());

  const [existingDraft, setExistingDraft] = useState<MonthlyReportRow | null>(null);

  // AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX. Set as early as
  // possible -- before the catalog or any preview is even fetched -- so a
  // teacher never gets deep into content selection only to discover a 409
  // at Finalise time. Holds ONLY the existing finalised report's id (the
  // one thing the "Open Finalised Report" link needs); the report itself
  // is never loaded here.
  const [existingFinalisedReportId, setExistingFinalisedReportId] = useState<string | null>(null);

  const [preview, setPreview] = useState<MonthlyReportPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const selectedSubject = subjects.find((subject) => subject.databaseId === subjectId) ?? null;

  // AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE. Once a report
  // is finalised, every draft-only control (selection, Generate Preview,
  // Save Draft, and everything inside the commentary section) must be
  // disabled -- server-side enforcement in monthlyReportRepository.ts is
  // what actually protects a finalised row, but the UI must never even
  // offer an action that can only fail.
  const isFinalised = existingDraft?.status === "finalised";

  // AD ASTRA MONTHLY REPORT -- STAGE 4B BUGFIX: the single place a
  // mutating report-row response (comments generated/regenerated, teacher
  // edits saved, or the report finalised) is folded back into state.
  // `preview` (the report actually displayed, and the one
  // commentsStale/hashMonthlyReportSnapshot compare against) is always
  // resynced to the row's current report_snapshot here -- UNCONDITIONALLY,
  // not just on finalisation. Regenerating Kingdom's commentary recomputes
  // report_snapshot server-side BEFORE generating (see the /comments
  // route), so kingdom_comments.snapshotHash is produced against that
  // FRESH snapshot; if `preview` were left pointing at the older snapshot
  // that was on screen before regeneration, commentsStale would keep
  // comparing the old data against the new hash and could wrongly stay
  // true forever, hiding Finalise Report even though the comments
  // genuinely do correspond to current evidence. Syncing here is safe for
  // every caller: comment generation/regeneration returns the freshly
  // recomputed snapshot (exactly what needs syncing), saving a teacher
  // edit returns the same unchanged snapshot (a harmless no-op sync), and
  // finalising returns the frozen final snapshot (unchanged behaviour).
  function handleDraftUpdated(updatedDraft: MonthlyReportRow) {
    setExistingDraft(updatedDraft);
    if (updatedDraft.report_snapshot) {
      setPreview(updatedDraft.report_snapshot);
    }
  }

  // Resets are performed directly in the triggering event handlers below
  // (handleSubjectChange/handleLearnerChange/handleMonthChange), not
  // inside the fetch effects -- an effect should only synchronise with
  // the external system (the API) it's reacting to, never also own
  // unrelated state resets, which belong with the event that caused them.
  function resetDownstreamOfSubject() {
    setLearners([]);
    setLearnerProfileId("");
    setCatalog(null);
    setSelectedLessonIds(new Set());
    setSelectedActivityIds(new Set());
    setExistingDraft(null);
    setExistingFinalisedReportId(null);
    setPreview(null);
    setPreviewError("");
    setSaveState("idle");
  }

  function resetDownstreamOfSelectionContext() {
    setCatalog(null);
    setSelectedLessonIds(new Set());
    setSelectedActivityIds(new Set());
    setExistingDraft(null);
    setExistingFinalisedReportId(null);
    setPreview(null);
    setPreviewError("");
    setSaveState("idle");
  }

  function handleSubjectChange(newSubjectId: string) {
    setSubjectId(newSubjectId);
    resetDownstreamOfSubject();
  }

  function handleLearnerChange(newLearnerProfileId: string) {
    setLearnerProfileId(newLearnerProfileId);
    resetDownstreamOfSelectionContext();
  }

  function handleMonthChange(newMonth: string) {
    setReportMonthInput(newMonth);
    resetDownstreamOfSelectionContext();
  }

  // Step 1/2: whenever the subject changes, load its enrolled learners.
  // Mirrors the established loading/fetch shape from
  // TeacherSubjectEnrolmentManager.tsx: the loading/error state updates
  // live inside the nested async function (invoked via `void`), not as
  // synchronous top-level statements in the effect body itself.
  useEffect(() => {
    if (!subjectId) return;

    let cancelled = false;

    async function loadLearners() {
      try {
        setLearnersLoading(true);
        const res = await fetch(`/api/teacher/reports/learners?subjectId=${subjectId}`);
        const data = await res.json();
        if (cancelled) return;
        setLearners(data.learners ?? []);
      } catch {
        if (!cancelled) setLearners([]);
      } finally {
        if (!cancelled) setLearnersLoading(false);
      }
    }

    void loadLearners();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Step 3: once subject + reporting month + learner are all chosen, first
  // check (cheaply, before anything else) whether this exact period
  // already has an official finalised report -- AD ASTRA MONTHLY REPORT
  // STAGE 4E: CREATE REPORT UX. If so, stop right there: never fetch the
  // catalog or generate a preview, never let the teacher get deep into
  // content selection only to hit a 409 at Finalise time. Otherwise,
  // proceed exactly as before -- load the full selectable catalog (every
  // lesson/activity with this learner's REAL status, regardless of
  // completion -- outstanding work must remain selectable) and check for
  // an existing DRAFT to reopen.
  useEffect(() => {
    if (!subjectId || !learnerProfileId || !reportMonthInput) return;

    let cancelled = false;

    async function load() {
      try {
        setCatalogLoading(true);
        setCatalogError("");

        const draftRes = await fetch(
          `/api/teacher/reports/draft?subjectId=${subjectId}&learnerProfileId=${learnerProfileId}&reportMonth=${reportMonthInput}`,
        );
        const draftData = await draftRes.json();
        if (!draftRes.ok) {
          throw new Error(draftData.error ?? "Unable to check for an existing report.");
        }
        if (cancelled) return;

        if (draftData.finalisedReportId) {
          setExistingFinalisedReportId(draftData.finalisedReportId);
          return;
        }
        if (draftData.draft) {
          setExistingDraft(draftData.draft);
          setSelectedLessonIds(new Set(draftData.draft.selected_lesson_ids));
          setSelectedActivityIds(new Set(draftData.draft.selected_activity_ids));
        }

        const catalogRes = await fetch(`/api/teacher/reports/catalog?subjectId=${subjectId}`);
        const catalogIds = await catalogRes.json();
        if (!catalogRes.ok) throw new Error(catalogIds.error ?? "Unable to load selectable content.");

        const previewRes = await fetch("/api/teacher/reports/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId,
            learnerProfileId,
            reportMonth: reportMonthInput,
            selectedLessonIds: catalogIds.lessonIds,
            selectedActivityIds: catalogIds.activityIds,
          }),
        });
        const previewData = await previewRes.json();
        if (!previewRes.ok) throw new Error(previewData.error ?? "Unable to load learner status.");
        if (cancelled) return;
        setCatalog(previewData.report);
      } catch (error) {
        if (!cancelled) {
          setCatalogError(
            error instanceof Error ? error.message : "Unable to load selectable content.",
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, learnerProfileId, reportMonthInput]);

  const linkedActivityByLessonId = useMemo(() => {
    const map = new Map<string, MonthlyReportActivityEntry>();
    for (const activity of catalog?.activities ?? []) {
      if (!map.has(activity.lessonId)) map.set(activity.lessonId, activity);
    }
    return map;
  }, [catalog]);

  function toggleLesson(lessonId: string) {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
        return next;
      }
      next.add(lessonId);
      // Convenience only -- the teacher can still untick the activity
      // afterwards; unticking the lesson never removes the activity.
      const linkedActivity = linkedActivityByLessonId.get(lessonId);
      if (linkedActivity) {
        setSelectedActivityIds((prevActivities) => {
          if (prevActivities.has(linkedActivity.activityId)) return prevActivities;
          const nextActivities = new Set(prevActivities);
          nextActivities.add(linkedActivity.activityId);
          return nextActivities;
        });
      }
      return next;
    });
  }

  function toggleActivity(activityId: string) {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function selectAll() {
    if (!catalog) return;
    setSelectedLessonIds(new Set(catalog.lessons.map((lesson) => lesson.lessonId)));
    setSelectedActivityIds(new Set(catalog.activities.map((activity) => activity.activityId)));
  }
  function clearAll() {
    setSelectedLessonIds(new Set());
    setSelectedActivityIds(new Set());
  }
  function selectLessonsOnly() {
    if (!catalog) return;
    setSelectedLessonIds(new Set(catalog.lessons.map((lesson) => lesson.lessonId)));
    setSelectedActivityIds(new Set());
  }
  function selectActivitiesOnly() {
    if (!catalog) return;
    setSelectedLessonIds(new Set());
    setSelectedActivityIds(new Set(catalog.activities.map((activity) => activity.activityId)));
  }

  async function generatePreview() {
    setPreviewError("");
    setSaveState("idle");
    if (selectedLessonIds.size === 0 && selectedActivityIds.size === 0) {
      setPreviewError("Select at least one lesson or activity before generating a preview.");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/teacher/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          learnerProfileId,
          reportMonth: reportMonthInput,
          selectedLessonIds: [...selectedLessonIds],
          selectedActivityIds: [...selectedActivityIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to generate the report preview.");
      setPreview(data.report);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Unable to generate the report preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveDraft() {
    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/teacher/reports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          learnerProfileId,
          reportMonth: reportMonthInput,
          selectedLessonIds: [...selectedLessonIds],
          selectedActivityIds: [...selectedActivityIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save the draft.");
      setExistingDraft(data.draft);
      setSaveState("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the draft.");
      setSaveState("error");
    }
  }

  const canGenerate = Boolean(subjectId && learnerProfileId && reportMonthInput && catalog);

  return (
    <div className="space-y-5">
      {/* Step 1 + 2: subject, month, learner */}
      <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className={`${neueHaas.className} mb-4 text-lg font-bold text-[#102A43]`}>
          1. Report Details
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Subject</p>
            <select
              value={subjectId}
              onChange={(event) => handleSubjectChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            >
              {subjects.map((subject) => (
                <option key={subject.databaseId} value={subject.databaseId}>
                  {subject.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Reporting Month</p>
            <input
              type="month"
              value={reportMonthInput}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
            {reportMonthInput ? (
              <p className="mt-1 text-xs text-slate-500">
                {formatReportMonthLabel(`${reportMonthInput}-01`)}
              </p>
            ) : null}
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-bold text-[#102A43]">Learner</p>
            <select
              value={learnerProfileId}
              onChange={(event) => handleLearnerChange(event.target.value)}
              disabled={learnersLoading || learners.length === 0}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1] disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {learnersLoading ? "Loading learners…" : "Select a learner"}
              </option>
              {learners.map((learner) => (
                <option key={learner.learnerProfileId} value={learner.learnerProfileId}>
                  {learner.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isFinalised ? (
          <p className="mt-3 rounded-2xl border border-[#102A43]/20 bg-[#102A43]/5 px-4 py-3 text-xs font-semibold text-[#102A43]">
            This report is finalised and is now a frozen historical record. It can no longer be
            edited, regenerated, or reselected.
          </p>
        ) : existingDraft ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            An existing draft for this learner/subject/month was found and its selection has
            been restored below.
          </p>
        ) : null}
      </section>

      {/* AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX. Detected as
          early as possible (before the catalog or any preview is even
          fetched, see the Step 3 effect above) -- a second official report
          for this exact learner/subject/reporting month is never offered,
          compactly, with a direct path to the one that already exists. */}
      {subjectId && learnerProfileId && reportMonthInput && existingFinalisedReportId ? (
        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#102A43]">
            A finalised report already exists for this learner and reporting period.
          </p>
          <Link
            href={`/teacher/reports/${existingFinalisedReportId}`}
            className="mt-3 inline-block rounded-2xl bg-[#102A43] px-5 py-2 text-sm font-bold text-white"
          >
            Open Finalised Report
          </Link>
        </section>
      ) : null}

      {/* Step 3: content selection */}
      {subjectId && learnerProfileId && reportMonthInput && !existingFinalisedReportId ? (
        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className={`${neueHaas.className} mb-4 text-lg font-bold text-[#102A43]`}>
            2. Select Report Content
          </h2>

          {catalogLoading ? (
            <p className="text-sm text-slate-500">Loading lessons and activities…</p>
          ) : catalogError ? (
            <p className="text-sm font-semibold text-red-600">{catalogError}</p>
          ) : catalog ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={isFinalised}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={isFinalised}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={selectLessonsOnly}
                  disabled={isFinalised}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Select Lessons Only
                </button>
                <button
                  type="button"
                  onClick={selectActivitiesOnly}
                  disabled={isFinalised}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Select Activities Only
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-bold text-[#102A43]">
                    Lessons ({catalog.lessons.length})
                  </h3>
                  <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-100 p-2">
                    {catalog.lessons.map((lesson) => (
                      <label
                        key={lesson.lessonId}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedLessonIds.has(lesson.lessonId)}
                          onChange={() => toggleLesson(lesson.lessonId)}
                          disabled={isFinalised}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              Lesson {lesson.lessonNumber}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lessonStatusTone(lesson.status)}`}
                            >
                              {lessonStatusLabel(lesson.status)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-600">{lesson.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {lesson.topicTitle ?? "No topic"} • Due {formatDueDate(lesson.dueDate)}
                          </p>
                        </div>
                      </label>
                    ))}
                    {catalog.lessons.length === 0 ? (
                      <p className="p-2 text-xs text-slate-400">No published lessons found.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-[#102A43]">
                    Activities ({catalog.activities.length})
                  </h3>
                  <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-100 p-2">
                    {catalog.activities.map((activity) => (
                      <label
                        key={activity.activityId}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedActivityIds.has(activity.activityId)}
                          onChange={() => toggleActivity(activity.activityId)}
                          disabled={isFinalised}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              Activity {activity.lessonNumber}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activityStatusTone(activity)}`}
                            >
                              {activityStatusLabel(activity)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-600">{activity.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {activity.topicTitle ?? "No topic"} • Due{" "}
                            {formatDueDate(activity.dueDate)}
                          </p>
                        </div>
                      </label>
                    ))}
                    {catalog.activities.length === 0 ? (
                      <p className="p-2 text-xs text-slate-400">No graded activities found.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-700">
                {selectedLessonIds.size} lesson{selectedLessonIds.size === 1 ? "" : "s"} selected ·{" "}
                {selectedActivityIds.size} activit{selectedActivityIds.size === 1 ? "y" : "ies"}{" "}
                selected
              </p>

              {previewError ? (
                <p className="mt-2 text-sm font-semibold text-red-600">{previewError}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={!canGenerate || previewLoading || isFinalised}
                  className="rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                  style={{ backgroundColor: selectedSubject?.colourTheme.primary ?? "#102A43" }}
                >
                  {previewLoading ? "Generating…" : "Generate Report Preview"}
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saveState === "saving" || isFinalised}
                  className="rounded-2xl border-2 border-[#102A43] px-6 py-3 text-sm font-bold text-[#102A43] disabled:opacity-50"
                >
                  {saveState === "saving" ? "Saving…" : "Save Draft"}
                </button>
                {saveState === "saved" ? (
                  <span className="self-center text-sm font-semibold text-green-700">
                    Draft saved.
                  </span>
                ) : null}
                {saveState === "error" ? (
                  <span className="self-center text-sm font-semibold text-red-600">
                    {saveError}
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* Preview */}
      {preview ? (
        <MonthlyReportPreview
          report={preview}
          subjectColour={selectedSubject?.colourTheme.primary ?? "#FEC20C"}
          draftId={existingDraft?.id ?? null}
          reportStatus={existingDraft?.status ?? null}
          finalisedAt={existingDraft?.finalised_at ?? null}
          kingdomComments={existingDraft?.kingdom_comments ?? null}
          teacherEditedComments={existingDraft?.teacher_edited_comments ?? null}
          onDraftUpdated={handleDraftUpdated}
        />
      ) : null}
    </div>
  );
}

// AD ASTRA MONTHLY REPORT -- STAGE 4D: exported so the internal historical
// report reader (components/teachers/HistoricalMonthlyReportView.tsx) can
// reuse this exact polished, read-only-when-finalised presentation --
// including the embedded MonthlyReportDelivery section -- for a
// previously finalised report, rather than a second, duplicate report
// renderer. Passing reportStatus="finalised" here already disables every
// draft-only control (selection, Generate Preview, Kingdom regeneration,
// comment editing, Finalise) -- see the isFinalised guards throughout this
// function -- so no further changes are needed for a purely historical,
// read-only reopening.
export function MonthlyReportPreview({
  report,
  subjectColour,
  draftId,
  reportStatus,
  finalisedAt,
  kingdomComments,
  teacherEditedComments,
  onDraftUpdated,
}: {
  report: MonthlyReportPayload;
  subjectColour: string;
  // AD ASTRA MONTHLY REPORT -- STAGE 3: Kingdom commentary is generated
  // against a SAVED draft row, never an ephemeral preview -- draftId is
  // null until the teacher has clicked Save Draft at least once.
  draftId: string | null;
  // AD ASTRA MONTHLY REPORT -- STAGE 4B: null until a draft row exists;
  // "finalised" locks every draft-only control in this component.
  reportStatus: "draft" | "finalised" | null;
  finalisedAt: string | null;
  kingdomComments: StoredMonthlyReportKingdomComments | null;
  teacherEditedComments: StoredMonthlyReportTeacherEditedComments | null;
  onDraftUpdated: (draft: MonthlyReportRow) => void;
}) {
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");

  const isFinalised = reportStatus === "finalised";

  // AD ASTRA MONTHLY REPORT -- STAGE 4A: the ONE centralised precedence
  // rule -- teacher-edited commentary is the approved version whenever it
  // exists, otherwise Kingdom's own generation. Never re-derived anywhere
  // else in this component. This remains correct even for a finalised
  // report: both columns are frozen (draft-only-gated) the instant
  // finalisation happens, so this is exactly how a finalised report's
  // approved commentary is resolved too -- no separate storage needed.
  const displayedComments = resolveDisplayedMonthlyReportComments({
    kingdomComments,
    teacherEditedComments,
  });

  const [isEditingComments, setIsEditingComments] = useState(false);
  const [editDraft, setEditDraft] = useState<KingdomMonthlyReportComments | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Stale relative to what's actually on screen right now, not merely
  // relative to the last-saved draft row -- the teacher may have changed
  // the selection and regenerated a preview since comments were generated
  // without having saved a new draft yet. Staleness is always judged
  // against Kingdom's own generation -- a teacher editing the wording
  // never makes a stale Kingdom generation current again.
  const commentsStale = Boolean(
    kingdomComments && kingdomComments.snapshotHash !== hashMonthlyReportSnapshot(report),
  );

  // AD ASTRA MONTHLY REPORT -- STAGE 4B BUG 2 FIX: ONE canonical freshness
  // state, computed once from commentsStale/displayedComments and consumed
  // by the single MonthlyReportFinaliseStatus component below (the ONE
  // place finalisation readiness is rendered -- see that component's own
  // header comment for why this was extracted and consolidated).
  const commentaryFreshness = deriveCommentaryFreshness(Boolean(displayedComments), commentsStale);

  async function generateComments() {
    if (!draftId || commentsLoading || isFinalised) return;
    setCommentsLoading(true);
    setCommentsError("");
    try {
      const res = await fetch(`/api/teacher/reports/${draftId}/comments`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to generate report comments.");
      // Regenerating Kingdom's commentary only ever touches kingdom_comments
      // server-side -- any existing teacher_edited_comments on the returned
      // row are untouched, so the teacher-edited version (if any) keeps
      // displaying as the approved version via displayedComments above.
      onDraftUpdated(data.draft);
    } catch (error) {
      setCommentsError(
        error instanceof Error ? error.message : "Unable to generate report comments.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }

  // Populates the editor from whatever is CURRENTLY displayed (teacher-
  // edited if present, otherwise Kingdom's) -- the teacher never starts
  // from blank fields when commentary already exists.
  function startEditingComments() {
    if (!displayedComments || isFinalised) return;
    setEditDraft({
      ...displayedComments,
      prioritiesNextMonth: [...displayedComments.prioritiesNextMonth],
    });
    setEditError("");
    setIsEditingComments(true);
  }

  function cancelEditingComments() {
    setEditDraft(null);
    setEditError("");
    setIsEditingComments(false);
  }

  // Lets the teacher intentionally replace the in-progress edit with
  // Kingdom's latest generated version -- only affects the local,
  // unsaved draft; the teacher must still click Save Changes to persist
  // it. This is the "clear way to intentionally replace/reset" the
  // regeneration-safety design calls for, without a separate destructive
  // reset action outside the editor.
  function useLatestKingdomVersion() {
    if (!kingdomComments) return;
    setEditDraft({
      ...kingdomComments.comments,
      prioritiesNextMonth: [...kingdomComments.comments.prioritiesNextMonth],
    });
  }

  function updateEditField(field: keyof Omit<KingdomMonthlyReportComments, "prioritiesNextMonth">, value: string) {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function updateEditPriority(index: number, value: string) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const prioritiesNextMonth = [...prev.prioritiesNextMonth];
      prioritiesNextMonth[index] = value;
      return { ...prev, prioritiesNextMonth };
    });
  }

  async function saveEditedComments() {
    if (!draftId || !editDraft || editSaving || isFinalised) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/teacher/reports/${draftId}/teacher-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save your changes.");
      onDraftUpdated(data.draft);
      setIsEditingComments(false);
      setEditDraft(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to save your changes.");
    } finally {
      setEditSaving(false);
    }
  }

  // AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE. A consequential,
  // one-way action -- requires explicit confirmation (the same
  // window.confirm pattern already used for other consequential actions
  // in this codebase, e.g. TeacherSubjectActivitiesPage.tsx's delete
  // confirmation) before ever calling the server. The server independently
  // re-validates every precondition (draft status, commentary staleness,
  // structural validity) regardless of what this button believes is true.
  async function finalizeReport() {
    if (!draftId || finalizing || isFinalised) return;

    const confirmed = window.confirm(
      "Finalise this report?\n\nOnce finalised, the report becomes the official record for this reporting period and can no longer be edited or regenerated.",
    );
    if (!confirmed) return;

    setFinalizing(true);
    setFinalizeError("");
    try {
      const res = await fetch(`/api/teacher/reports/${draftId}/finalize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to finalise this report.");
      onDraftUpdated(data.report);
    } catch (error) {
      setFinalizeError(
        error instanceof Error ? error.message : "Unable to finalise this report.",
      );
    } finally {
      setFinalizing(false);
    }
  }

  // AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
  // Resolved via the one canonical resolver (also used by the public,
  // unauthenticated report view) rather than a locally re-implemented
  // key-to-asset map -- null (an unrecognised/legacy key) is a real,
  // expected outcome that must render a neutral fallback below, never crash.
  const badge = resolveMonthlyReportBadgeAsset(report.badge?.key);
  const returnedActivityCount = report.activities.filter(
    (activity) => activity.hasAuthoritativeMark,
  ).length;

  const evidenceWarnings: string[] = [];
  if (report.evidenceFlags.unreviewedSubmissionsPresent) {
    const count = report.engagement.activitiesAwaitingReview;
    evidenceWarnings.push(
      `${count} activit${count === 1 ? "y is" : "ies are"} awaiting teacher review and not yet reflected in the academic average.`,
    );
  }
  if (report.evidenceFlags.insufficientMarkedEvidence) {
    evidenceWarnings.push(
      "Academic judgement is based on limited evidence (fewer than 4 teacher-reviewed activities).",
    );
  }
  if (report.evidenceFlags.lowCompletionRatio) {
    evidenceWarnings.push("Activity completion for this period is below 50%.");
  }
  if (report.evidenceFlags.substantialOutstandingWork) {
    evidenceWarnings.push("A substantial amount of selected work remains outstanding.");
  }
  if (report.evidenceFlags.insufficientForTrend) {
    evidenceWarnings.push("There is not yet enough evidence to identify a performance trend.");
  }
  if (report.evidenceFlags.topicCoverageGaps.length > 0) {
    evidenceWarnings.push(
      `No teacher-reviewed evidence yet for: ${report.evidenceFlags.topicCoverageGaps.join(", ")}.`,
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] shadow-lg">
      <div className="relative bg-[#102A43] px-6 py-5 text-white lg:px-10 lg:py-6">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: subjectColour }}
          aria-hidden="true"
        />
        {/* Compact three-zone masthead: report info (left) / logo (centre,
            genuinely centred on the whole header via the 1fr/auto/1fr
            track, not just the space remaining beside the text) / badge
            (right). Stacks centred on narrow screens, where a horizontal
            three-zone layout has no room to breathe. */}
        <div className="flex flex-col items-center gap-4 text-center lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6 lg:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#FEC20C]">
              Monthly Progress Report
            </p>
            <h2 className={`${neueHaas.className} mt-1 text-2xl font-bold text-white lg:text-3xl`}>
              {report.meta.learnerName}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {report.meta.subjectName} · {formatReportMonthLabel(report.meta.reportMonth)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/50">
              Subject Teacher: {report.meta.teacherName ?? "Not available"}
            </p>
          </div>

          <Image
            src="/ad_astra_logo.png"
            alt="AD Astra Logo"
            width={160}
            height={160}
            unoptimized
            className="h-16 w-16 object-contain lg:h-20 lg:w-20"
          />

          <div className="flex justify-center lg:justify-end">
            {badge ? (
              <Image
                src={badge.src}
                alt={badge.alt}
                width={140}
                height={140}
                unoptimized
                className="h-14 w-14 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.45)] lg:h-16 lg:w-16"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-white p-6 lg:p-10">
        {/* At a Glance */}
        <div>
          <h3 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
            At a Glance
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <GlanceStat
              label="Lessons Completed"
              value={`${report.engagement.lessonsCompleted} of ${report.engagement.lessonsSelected}`}
            />
            <GlanceStat
              label="Activities Submitted"
              value={`${report.engagement.activitiesSubmitted} of ${report.engagement.activitiesSelected}`}
            />
            <GlanceStat
              label="Activities Outstanding"
              value={String(report.engagement.activitiesOutstanding)}
            />
            <GlanceStat
              label="Academic Average"
              value={formatPercentage(report.academic.academicPercentage)}
            />
            <GlanceStat label="Overall Badge" value={badge?.label ?? "Not Available"} />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            {academicBasisSummary(report.academic)}
          </p>
          {report.academic.awaitingReviewActivityCount > 0 ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Academic result is provisional because{" "}
              {report.academic.awaitingReviewActivityCount} selected{" "}
              {report.academic.awaitingReviewActivityCount === 1 ? "activity is" : "activities are"}{" "}
              awaiting teacher review.
            </p>
          ) : null}
        </div>

        {/* Progress by Topic */}
        {report.academic.topicBreakdown.length > 0 ? (
          <div>
            <h3 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
              Progress by Topic
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Topic</th>
                    <th className="px-4 py-2">Marked Activities</th>
                    <th className="px-4 py-2">Weighted Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.academic.topicBreakdown.map((topic) => (
                    <tr key={topic.topicTitle} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-800">{topic.topicTitle}</td>
                      <td className="px-4 py-2 text-slate-600">{topic.activityCount}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {topic.earnedMarks}/{topic.availableMarks} ({topic.percentage.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Included Work */}
        <div>
          <h3 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
            Included Work in This Report
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Lesson</th>
                    <th className="px-4 py-2">Topic</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lessons.map((lesson) => (
                    <tr key={lesson.lessonId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-800">
                        {lesson.lessonNumber}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{lesson.topicTitle ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lessonStatusTone(lesson.status)}`}
                        >
                          {lessonStatusLabel(lesson.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {report.lessons.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                        No lessons were selected for this report.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Activity</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.activities.map((activity) => (
                    <tr key={activity.activityId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-800">
                        {activity.lessonNumber}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activityStatusTone(activity)}`}
                        >
                          {activityStatusLabel(activity)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {activity.hasAuthoritativeMark
                          ? `${activity.finalMark}/${activity.totalMarks} (${formatPercentage(activity.percentage)})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {report.activities.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                        No activities were selected for this report.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {returnedActivityCount} of {report.activities.length} selected activities have a
            teacher-authoritative result.
          </p>
        </div>

        {/* Engagement */}
        <div>
          <h3 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
            Work Ethic &amp; Engagement Summary
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GlanceStat label="Lesson Engagement" value={formatRate(report.engagement.lessonCompletionRate)} />
            <GlanceStat label="Activity Completion" value={formatRate(report.engagement.activitySubmissionRate)} />
            <GlanceStat
              label="On-Time Work"
              value={formatOnTimeWork(
                report.engagement.onTimeWorkCompletedCount,
                report.engagement.onTimeWorkDueCount,
              )}
            />
          </div>
        </div>

        {/* Evidence warnings */}
        {evidenceWarnings.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-amber-900">Evidence Notes for the Teacher</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
              {evidenceWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Kingdom Commentary */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className={`${neueHaas.className} text-lg font-bold text-[#102A43]`}>
              Kingdom Commentary
            </h3>
            {draftId && !isEditingComments && !isFinalised ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateComments()}
                  disabled={commentsLoading}
                  className="rounded-2xl bg-[#102A43] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {commentsLoading
                    ? "Generating…"
                    : kingdomComments
                      ? "Regenerate Comments"
                      : "Generate Report Comments"}
                </button>
                {displayedComments ? (
                  <button
                    type="button"
                    onClick={startEditingComments}
                    className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43]"
                  >
                    Edit Report Comments
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {!draftId ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs italic text-slate-400">
              Save this report as a draft before generating Kingdom commentary.
            </p>
          ) : null}

          {commentsError ? (
            <p className="mb-3 text-xs font-semibold text-red-600">{commentsError}</p>
          ) : null}

          {isEditingComments && editDraft ? (
            <div className="space-y-3">
              {(
                [
                  ["academicDevelopment", "Academic Development"],
                  ["workEthicEngagement", "Work Ethic & Engagement"],
                  ["examReadiness", "Exam Readiness"],
                  ["generalProgress", "General Progress"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="rounded-2xl border border-slate-200 p-4">
                  <label className="text-sm font-bold text-[#102A43]" htmlFor={`edit-${field}`}>
                    {label}
                  </label>
                  <textarea
                    id={`edit-${field}`}
                    value={editDraft[field]}
                    onChange={(event) => updateEditField(field, event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#508DB1]"
                  />
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="text-sm font-bold text-[#102A43]">Priorities for Next Month</h4>
                <div className="mt-1 space-y-2">
                  {editDraft.prioritiesNextMonth.map((priority, index) => (
                    <input
                      // Index key is safe here: a fixed-size list (2-3
                      // priorities) edited in place, never reordered,
                      // added to, or removed from in this stage.
                      key={index}
                      type="text"
                      value={priority}
                      onChange={(event) => updateEditPriority(index, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#508DB1]"
                    />
                  ))}
                </div>
              </div>

              {editError ? <p className="text-xs font-semibold text-red-600">{editError}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveEditedComments()}
                  disabled={editSaving}
                  className="rounded-2xl bg-[#102A43] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditingComments}
                  disabled={editSaving}
                  className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43] disabled:opacity-50"
                >
                  Cancel
                </button>
                {kingdomComments && teacherEditedComments ? (
                  <button
                    type="button"
                    onClick={useLatestKingdomVersion}
                    disabled={editSaving}
                    className="rounded-2xl px-4 py-2 text-xs font-semibold text-slate-500 underline disabled:opacity-50"
                  >
                    Use Kingdom&apos;s Latest Version
                  </button>
                ) : null}
              </div>
            </div>
          ) : displayedComments ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">
                {isFinalised
                  ? "Finalised Approved Commentary"
                  : teacherEditedComments
                    ? "Teacher-Approved Version"
                    : "Kingdom-Generated (Not Yet Reviewed)"}
              </p>
              {(
                [
                  ["Academic Development", displayedComments.academicDevelopment],
                  ["Work Ethic & Engagement", displayedComments.workEthicEngagement],
                  ["Exam Readiness", displayedComments.examReadiness],
                  ["General Progress", displayedComments.generalProgress],
                ] as const
              ).map(([label, text]) => (
                <div key={label} className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-sm font-bold text-[#102A43]">{label}</h4>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="text-sm font-bold text-[#102A43]">Priorities for Next Month</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {displayedComments.prioritiesNextMonth.map((priority) => (
                    <li key={priority}>{priority}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : draftId ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs italic text-slate-400">
              No Kingdom commentary has been generated for this report yet.
            </p>
          ) : null}
        </div>

        {/* Finalise Report -- the ONE place finalisation readiness is
            rendered; see MonthlyReportFinaliseStatus's own header comment. */}
        {draftId ? (
          <MonthlyReportFinaliseStatus
            isFinalised={isFinalised}
            finalisedAt={finalisedAt}
            commentaryFreshness={commentaryFreshness}
            finalizing={finalizing}
            finalizeError={finalizeError}
            onFinalize={() => void finalizeReport()}
          />
        ) : null}

        {/* AD ASTRA MONTHLY REPORT -- STAGE 4C: delivery is only ever
            offered once a report is finalised -- a draft must never be
            emailed, and draftId doubles as reportId once finalised. */}
        {isFinalised && draftId ? <MonthlyReportDelivery reportId={draftId} /> : null}
      </div>
    </section>
  );
}

export function GlanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#102A43]">{value}</p>
    </div>
  );
}
