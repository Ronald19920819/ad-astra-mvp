"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LearnerOnboardingState } from "@/lib/supabase/learnerOnboarding";

export default function LearnerProfileOnboardingPage() {
  const router = useRouter();
  const [onboarding, setOnboarding] =
    useState<LearnerOnboardingState | null>(null);
  const [school, setSchool] = useState("");
  const [gradeOrStage, setGradeOrStage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    void fetch("/api/learner/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          onboarding?: LearnerOnboardingState;
        };
        if (!active) return;
        if (!response.ok || !result.onboarding) {
          router.replace("/login");
          return;
        }
        setOnboarding(result.onboarding);
        setSchool(result.onboarding.profile.school ?? "");
        setGradeOrStage(result.onboarding.profile.gradeOrStage ?? "");
      })
      .catch((error) => {
        console.error("Unable to load learner onboarding:", error);
        if (active) setErrorMessage("Unable to load your learner profile.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    try {
      setIsSaving(true);
      setErrorMessage("");
      const response = await fetch("/api/learner/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, gradeOrStage }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Unable to save your learner profile.",
        );
        return;
      }
      router.replace("/onboarding/subjects");
      router.refresh();
    } catch (error) {
      console.error("Unable to save learner onboarding:", error);
      setErrorMessage("Unable to save your learner profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-[#508DB1]">
          Learner Onboarding
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#102A43]">
          Complete Your Profile
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isLoading
            ? "Loading your profile..."
            : `Welcome, ${onboarding?.profile.displayName ?? "Learner"}.`}
        </p>

        <form className="mt-6 space-y-5" onSubmit={saveProfile}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#102A43]">
              School
            </span>
            <input
              required
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#508DB1]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#102A43]">
              Grade / Stage
            </span>
            <input
              required
              value={gradeOrStage}
              onChange={(event) => setGradeOrStage(event.target.value)}
              placeholder="For example Grade 10 or Cambridge IGCSE"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#508DB1]"
            />
          </label>

          {errorMessage && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="w-full rounded-2xl bg-[#102A43] py-3.5 font-bold text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Continue to Subjects"}
          </button>
        </form>
      </section>
    </main>
  );
}

