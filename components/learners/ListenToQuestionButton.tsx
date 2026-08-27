"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import {
  clearActiveQuestionAudioIfSelf,
  registerActiveQuestionAudio,
} from "@/lib/accessibility/questionAudioController";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

const UNAVAILABLE_MESSAGE = "Question audio is unavailable. Please try again.";

// Stage C "Listen to Question" control. Rendered ONLY by a parent that
// has already confirmed (server-side, via
// lib/supabase/learnerAccessibilityStatus.ts) that the current learner is
// accessibility-entitled -- an accessibility-disabled learner never sees
// this component at all, matching AD ASTRA ACCESSIBILITY STAGE C section
// 2. The endpoint itself independently re-verifies entitlement and
// question ownership on every request regardless (never trusts that this
// component was only rendered for an entitled learner).
//
// Play/Pause toggle (not restart-on-click), matching this app's
// established audio-control convention (LessonAccessibilityAudioPlayer):
// pressing while idle/error/finished fetches (or re-fetches, on a stale
// signed URL) a fresh signed URL and starts from the beginning; pressing
// while playing pauses in place; pressing while paused resumes from
// exactly where it left off. A stale/expired signed URL surfaces as the
// friendly error state with Try Again, which itself re-fetches a fresh
// URL -- short clips make Stage B's more elaborate mid-seek refresh
// machinery unnecessary here.
//
// Playback only: never selects an answer, never marks anything complete,
// never touches XP/Coins.
export function ListenToQuestionButton({ endpoint }: { endpoint: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      const audioElement = audioRef.current;
      if (audioElement) {
        audioElement.pause();
        clearActiveQuestionAudioIfSelf(audioElement);
      }
    };
  }, []);

  function ensureAudioElement(): HTMLAudioElement {
    if (audioRef.current) return audioRef.current;

    const element = new Audio();
    element.addEventListener("ended", () => {
      clearActiveQuestionAudioIfSelf(element);
      setStatus("idle");
    });
    element.addEventListener("error", () => {
      clearActiveQuestionAudioIfSelf(element);
      setStatus("error");
    });
    audioRef.current = element;
    return element;
  }

  async function playFromStart() {
    setStatus("loading");
    try {
      const response = await fetch(endpoint);
      const result = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !result.url) {
        setStatus("error");
        return;
      }

      const audioElement = ensureAudioElement();
      audioElement.src = result.url;
      registerActiveQuestionAudio(audioElement, () => setStatus("idle"));
      await audioElement.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }

  function pause() {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    audioElement.pause();
    clearActiveQuestionAudioIfSelf(audioElement);
    setStatus("paused");
  }

  async function resume() {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    registerActiveQuestionAudio(audioElement, () => setStatus("idle"));
    try {
      await audioElement.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }

  function handlePress() {
    if (status === "idle" || status === "error") {
      void playFromStart();
    } else if (status === "playing") {
      pause();
    } else if (status === "paused") {
      void resume();
    }
    // "loading": ignore extra presses until the current fetch settles.
  }

  const label =
    status === "playing"
      ? "Pause question audio"
      : status === "paused"
        ? "Resume question audio"
        : "Listen to Question";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handlePress}
        disabled={status === "loading"}
        aria-label={label}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"
      >
        {status === "playing" ? <Pause size={14} /> : status === "paused" ? <Play size={14} /> : <Volume2 size={14} />}
        {status === "loading"
          ? "Loading..."
          : status === "playing"
            ? "Listening..."
            : status === "paused"
              ? "Resume"
              : "Listen to Question"}
      </button>
      {status === "error" && (
        <span role="status" className="flex items-center gap-2 text-xs font-semibold text-red-700">
          {UNAVAILABLE_MESSAGE}
          <button type="button" onClick={() => void playFromStart()} className="underline">
            Try Again
          </button>
        </span>
      )}
    </div>
  );
}
