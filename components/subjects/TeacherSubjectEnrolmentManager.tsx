"use client";

import { useEffect, useMemo, useState } from "react";

type ManagedSubject = {
  id: string;
  name: string;
  colour: string;
  familyKey: string;
};

type LearnerEnrolment = {
  enrolmentId: string;
  learnerProfileId: string;
  firstName: string;
  surname: string;
  fullName: string;
  grade: string | null;
  status: "pending" | "approved" | "declined";
  isActive: boolean;
  statusLabel: string;
};

type SelectedLearner = LearnerEnrolment & {
  subjectId: string;
  subjectName: string;
};

function statusPillClass(statusLabel: string) {
  if (statusLabel === "Active") return "bg-green-100 text-green-700";
  if (statusLabel === "Pending") return "bg-amber-100 text-amber-700";
  if (statusLabel === "Inactive") return "bg-slate-100 text-slate-600";
  return "bg-red-100 text-red-700";
}

export function TeacherSubjectEnrolmentManager({
  subjects,
}: {
  subjects: ManagedSubject[];
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    subjects[0]?.id ?? "",
  );
  const [learners, setLearners] = useState<LearnerEnrolment[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(subjects[0]?.id));
  const [loadError, setLoadError] = useState("");
  const [selectedLearner, setSelectedLearner] =
    useState<SelectedLearner | null>(null);
  const [actionMode, setActionMode] = useState<"move" | "assign">("move");
  const [targetSubjectId, setTargetSubjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">(
    "success",
  );

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects],
  );

  const destinationSubjects = useMemo(
    () =>
      subjects.filter((subject) => {
        if (!selectedSubject) return false;
        return (
          subject.id !== selectedSubject.id &&
          subject.familyKey === selectedSubject.familyKey
        );
      }),
    [selectedSubject, subjects],
  );

  useEffect(() => {
    if (!selectedSubjectId) return;

    let isActive = true;

    async function loadLearners() {
      try {
        setIsLoading(true);
        setLoadError("");
        const response = await fetch(
          `/api/teacher/subject-enrolments?subjectId=${encodeURIComponent(selectedSubjectId)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          learners?: LearnerEnrolment[];
          error?: string;
        };

        if (!response.ok || !result.learners) {
          throw new Error(result.error || "Unable to load enrolled learners.");
        }

        if (isActive) setLearners(result.learners);
      } catch (error) {
        if (isActive) {
          setLearners([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load enrolled learners.",
          );
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadLearners();
    return () => {
      isActive = false;
    };
  }, [selectedSubjectId]);

  const effectiveTargetSubjectId =
    targetSubjectId || destinationSubjects[0]?.id || "";

  function openManageLearnerModal(learner: LearnerEnrolment) {
    if (!selectedSubject) return;

    setSelectedLearner({
      ...learner,
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
    });
    setActionMode(
      learner.status === "approved" && learner.isActive ? "move" : "assign",
    );
    setTargetSubjectId(destinationSubjects[0]?.id ?? "");
  }

  async function submitChange() {
    if (!selectedLearner || !effectiveTargetSubjectId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/teacher/subject-enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerProfileId: selectedLearner.learnerProfileId,
          sourceSubjectId: selectedLearner.subjectId,
          targetSubjectId: effectiveTargetSubjectId,
          mode: actionMode,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "The learner enrolment could not be updated.");
      }

      setFeedbackTone("success");
      setFeedbackMessage(result.message || "Learner enrolment updated.");
      setSelectedLearner(null);

      const refreshResponse = await fetch(
        `/api/teacher/subject-enrolments?subjectId=${encodeURIComponent(selectedSubjectId)}`,
        { cache: "no-store" },
      );
      const refreshResult = (await refreshResponse.json()) as {
        learners?: LearnerEnrolment[];
      };
      setLearners(refreshResult.learners ?? []);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof Error
          ? error.message
          : "The learner enrolment could not be updated.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Enrolled Learners</h2>
        <p className="text-sm text-slate-500">
          View learners in a subject and safely move them between cohort groups.
        </p>
      </div>

      <div className="mb-4 space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Selected subject
        </label>
        <select
          value={selectedSubjectId}
          onChange={(event) => {
            setSelectedSubjectId(event.target.value);
            setFeedbackMessage("");
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      {feedbackMessage && (
        <p
          className={`mb-4 rounded-2xl p-3 text-sm font-semibold ${
            feedbackTone === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedbackMessage}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading enrolled learners...</p>
      ) : loadError ? (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {loadError}
        </p>
      ) : learners.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          No learner enrolments are available for this subject yet.
        </p>
      ) : (
        <div className="space-y-3">
          {learners.map((learner) => (
            <div
              key={learner.enrolmentId}
              className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-slate-900">
                    {learner.firstName || learner.surname
                      ? `${learner.firstName} ${learner.surname}`.trim()
                      : learner.fullName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {learner.grade ? `Grade ${learner.grade}` : "Grade not set"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                    learner.statusLabel,
                  )}`}
                >
                  {learner.statusLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openManageLearnerModal(learner)}
                className="mt-3 rounded-full bg-[#508DB1] px-4 py-2 text-xs font-semibold text-white"
              >
                Manage enrolment
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedLearner && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <section className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">
              Confirm learner enrolment change
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              Learner: <strong>{selectedLearner.fullName}</strong>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Current subject: <strong>{selectedLearner.subjectName}</strong>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionMode("move")}
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                  actionMode === "move"
                    ? "border-[#508DB1] bg-[#EEF7FF] text-[#508DB1]"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Move learner
              </button>
              <button
                type="button"
                onClick={() => setActionMode("assign")}
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                  actionMode === "assign"
                    ? "border-[#508DB1] bg-[#EEF7FF] text-[#508DB1]"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Assign additional
              </button>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Destination subject
            </label>
            <select
              value={effectiveTargetSubjectId}
              onChange={(event) => setTargetSubjectId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
            >
              {destinationSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {actionMode === "move"
                ? "Move deactivates the current active enrolment and reactivates or creates the destination enrolment."
                : "Assign Additional keeps the current enrolment and adds or reactivates the destination enrolment."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedLearner(null)}
                disabled={isSubmitting}
                className="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitChange()}
                disabled={isSubmitting || !effectiveTargetSubjectId}
                className="rounded-2xl bg-[#508DB1] py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSubmitting
                  ? "Saving..."
                  : actionMode === "move"
                    ? "Confirm Move"
                    : "Confirm Assignment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
