"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LearnerOnboardingState } from "@/lib/supabase/learnerOnboarding";
import { canRequestLearnerSubject } from "@/lib/learners/onboarding";

export default function LearnerSubjectRequestsPage() {
  const router = useRouter();
  const [onboarding, setOnboarding] =
    useState<LearnerOnboardingState | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  const fetchOnboarding = useCallback(async () => {
    const response = await fetch("/api/learner/onboarding", {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      onboarding?: LearnerOnboardingState;
    };
    if (!response.ok || !result.onboarding) {
      router.replace("/login");
      return null;
    }
    if (!result.onboarding.profile.isComplete) {
      router.replace("/onboarding/profile");
      return null;
    }
    return result.onboarding;
  }, [router]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await fetchOnboarding();
        if (active && result) setOnboarding(result);
      } catch (error) {
        console.error("Unable to load subject requests:", error);
        if (active) setErrorMessage("Unable to load available subjects.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [fetchOnboarding]);

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
  }

  async function submitRequests() {
    if (isSubmitting) return;
    if (selectedSubjectIds.length === 0) {
      setErrorMessage("Select at least one subject.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const response = await fetch("/api/learner/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Unable to send subject requests.");
        return;
      }
      router.replace("/onboarding/complete");
      router.refresh();
    } catch (error) {
      console.error("Unable to request learner subjects:", error);
      setErrorMessage("Unable to send subject requests.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deregisterSubject(subjectId: string) {
    if (removingSubjectId) return;
    if (!window.confirm("Deregister this subject?")) return;

    try {
      setRemovingSubjectId(subjectId);
      setErrorMessage("");
      const response = await fetch("/api/learner/onboarding", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(result.error ?? "Unable to deregister this subject.");
        return;
      }
      const refreshed = await fetchOnboarding();
      if (refreshed) setOnboarding(refreshed);
    } catch (error) {
      console.error("Unable to deregister learner subject:", error);
      setErrorMessage("Unable to deregister this subject.");
    } finally {
      setRemovingSubjectId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-[#508DB1]">
          Learner Onboarding
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#102A43]">
          Request Subjects
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose one or more subjects. Your teacher must approve each request
          before the subject becomes available.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-600">Loading subjects...</p>
        ) : (
          <div className="mt-6 space-y-3">
            {onboarding?.subjects.map((subject) => {
              const canRequest = canRequestLearnerSubject(subject.status);
              const selected = selectedSubjectIds.includes(subject.id);
              const statusLabel =
                subject.status === "approved"
                  ? "Approved"
                  : subject.status === "pending"
                    ? "Pending Approval"
                    : subject.status === "declined"
                      ? "Declined — request again"
                      : subject.status === "inactive"
                        ? "Deregistered — request again"
                        : "Available";

              return (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      disabled={!canRequest}
                      checked={selected}
                      onChange={() => toggleSubject(subject.id)}
                      className="h-5 w-5 accent-[#102A43]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[#102A43]">
                        {subject.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {statusLabel}
                      </span>
                    </span>
                  </label>
                  {subject.status === "approved" && (
                    <button
                      type="button"
                      disabled={removingSubjectId === subject.id}
                      onClick={() => void deregisterSubject(subject.id)}
                      className="mt-3 text-xs font-bold text-red-600 disabled:opacity-60"
                    >
                      {removingSubjectId === subject.id
                        ? "Deregistering..."
                        : "Deregister Subject"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submitRequests()}
          disabled={
            isLoading || isSubmitting || selectedSubjectIds.length === 0
          }
          className="mt-6 w-full rounded-2xl bg-[#102A43] py-3.5 font-bold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Sending requests..." : "Send Subject Requests"}
        </button>
        {onboarding?.hasAnySubjectRequest && (
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="mt-3 w-full rounded-2xl border border-blue-100 py-3 font-bold text-[#102A43]"
          >
            Return Home
          </button>
        )}
      </section>
    </main>
  );
}
