"use client";

import { useEffect, useState } from "react";

type AccessibilityStatusResponse = {
  hasReading: boolean;
  isStale?: boolean;
  transcriptStatus?: "not_prepared" | "generated" | "approved";
  audioStatus?: "not_generated" | "generating" | "ready" | "failed";
  language?: "english" | "afrikaans" | null;
  voice?: "cedar" | "marin" | null;
  transcript?: string | null;
  validationNotes?: string | null;
  approvedAt?: string | null;
  audioGeneratedAt?: string | null;
  segmentCount?: number;
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

function describeStatus(data: AccessibilityStatusResponse) {
  if (data.isStale) return "Stale — reading changed";
  if (data.transcriptStatus === "approved" && data.audioStatus === "ready") {
    return "Ready";
  }
  if (data.transcriptStatus === "approved") {
    return "Approved — audio not generated";
  }
  if (data.transcriptStatus === "generated") {
    return "Transcript ready for review";
  }
  return "Not prepared";
}

function statusBadgeClassName(data: AccessibilityStatusResponse) {
  if (data.isStale) return "bg-amber-100 text-amber-800";
  if (data.transcriptStatus === "approved" && data.audioStatus === "ready") {
    return "bg-green-100 text-green-700";
  }
  if (data.transcriptStatus === "approved" || data.transcriptStatus === "generated") {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-slate-100 text-slate-600";
}

// Stage B teacher/admin preparation card:
// Generate Transcript -> review/edit -> Approve -> Generate Audio.
// Every action re-fetches the canonical status from the server afterward
// rather than optimistically guessing the next state client-side.
export function AccessibilityAudioCard({
  subjectId,
  lessonId,
}: {
  subjectId: string;
  lessonId: string;
}) {
  const [data, setData] = useState<AccessibilityStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadStatus() {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/teacher/accessibility/lesson-reading?subjectId=${encodeURIComponent(
            subjectId,
          )}&lessonId=${encodeURIComponent(lessonId)}`,
        );
        const result = (await response.json()) as AccessibilityStatusResponse;
        if (!response.ok) {
          throw new Error(result.error || "The accessibility status could not be loaded.");
        }
        if (isActive) {
          setData(result);
          setDraftTranscript(result.transcript ?? "");
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : "The accessibility status could not be loaded.",
          );
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadStatus();
    return () => {
      isActive = false;
    };
  }, [subjectId, lessonId]);

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setIsWorking(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/teacher/accessibility/lesson-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, lessonId, action, ...extra }),
      });
      const result = (await response.json()) as AccessibilityStatusResponse;
      if (!response.ok) {
        throw new Error(result.error || "This action could not be completed.");
      }
      setData(result);
      setDraftTranscript(result.transcript ?? "");
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "This action could not be completed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Loading accessibility audio status...</p>
      </section>
    );
  }

  if (!data?.hasReading) return null;

  const statusLabel = describeStatus(data);
  const canApprove = data.transcriptStatus === "generated" && !data.isStale;
  const canGenerateAudio = data.transcriptStatus === "approved" && !data.isStale;

  return (
    <section className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Accessibility Audio</h2>
          <p className="mt-1 text-sm text-slate-500">
            Listen-to-reading preparation for accessibility-enabled learners.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClassName(data)}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">Language</p>
          <p className="mt-1 font-bold text-slate-900">
            {data.language ? (data.language === "afrikaans" ? "Afrikaans" : "English") : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">Voice</p>
          <p className="mt-1 font-bold text-slate-900">
            {data.voice ? data.voice[0].toUpperCase() + data.voice.slice(1) : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">Last approved</p>
          <p className="mt-1 font-bold text-slate-900">{formatDate(data.approvedAt)}</p>
        </div>
      </div>

      {data.validationNotes && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {data.validationNotes}
        </p>
      )}
      {data.isStale && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          The reading has changed since this transcript was prepared. Regenerate the transcript to update accessibility audio.
        </p>
      )}
      {errorMessage && (
        <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}

      {isEditing && (
        <div className="mt-4">
          <textarea
            value={draftTranscript}
            onChange={(event) => setDraftTranscript(event.target.value)}
            className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white p-3 font-sans text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isWorking}
          onClick={() => runAction("generate-transcript")}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isWorking ? "Working..." : data.transcriptStatus === "not_prepared" ? "Generate Transcript" : "Regenerate Transcript"}
        </button>

        {data.transcript && !isEditing && (
          <button
            type="button"
            disabled={isWorking}
            onClick={() => setIsEditing(true)}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            Review / Edit
          </button>
        )}

        {isEditing && (
          <>
            <button
              type="button"
              disabled={isWorking || !draftTranscript.trim()}
              onClick={() => runAction("save-transcript", { transcript: draftTranscript })}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-wait disabled:opacity-60"
            >
              Save Edits
            </button>
            <button
              type="button"
              disabled={isWorking}
              onClick={() => {
                setIsEditing(false);
                setDraftTranscript(data.transcript ?? "");
              }}
              className="rounded-2xl px-4 py-2 text-sm font-bold text-slate-500"
            >
              Cancel
            </button>
          </>
        )}

        <button
          type="button"
          disabled={isWorking || !canApprove}
          onClick={() => runAction("approve-transcript")}
          className="rounded-2xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve Transcript
        </button>

        <button
          type="button"
          disabled={isWorking || !canGenerateAudio}
          onClick={() => runAction("generate-audio")}
          className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {data.audioStatus === "ready" ? "Regenerate Audio" : "Generate Audio"}
        </button>
      </div>
    </section>
  );
}
