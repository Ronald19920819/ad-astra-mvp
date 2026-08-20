"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type PlayerStateEvent = { data: number };

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (event: PlayerStateEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

function getYouTubeApi() {
  return (window as typeof window & { YT?: YouTubeNamespace }).YT;
}

type TrackedYouTubePlayerProps = {
  lessonId: string;
  materialId: string;
  title: string;
  videoId: string;
  // Fired with the server's response every time a progress ping is saved,
  // so the page can reflect adaptive lesson completion live (e.g. video
  // crossing the completion threshold while the learner keeps watching)
  // without needing to reload. Purely additive/read-only -- never affects
  // playback or tracking behavior.
  onProgressSaved?: (result: unknown) => void;
};

export function TrackedYouTubePlayer({
  lessonId,
  materialId,
  title,
  videoId,
  onProgressSaved,
}: TrackedYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const onProgressSavedRef = useRef(onProgressSaved);

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved;
  }, [onProgressSaved]);

  const saveProgress = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const positionSeconds = player.getCurrentTime();
    const durationSeconds = player.getDuration();
    if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    fetch("/api/lessons/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "video_progress",
        lessonId,
        videoMaterialId: materialId,
        positionSeconds,
        durationSeconds,
      }),
      keepalive: true,
    })
      .then((response) => response.json())
      .then((result) => onProgressSavedRef.current?.(result))
      .catch((error) => console.error("Unable to save video progress:", error));
  }, [lessonId, materialId]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleScriptReady = useCallback(() => {
    let attempt = 0;

    function checkApi() {
      if (getYouTubeApi()?.Player) {
        setApiReady(true);
        return;
      }

      attempt += 1;
      if (attempt < 100) window.setTimeout(checkApi, 50);
    }

    checkApi();
  }, []);

  useEffect(() => {
    const yt = getYouTubeApi();
    const container = containerRef.current;
    if (!apiReady || !yt || !container || playerRef.current) return;

    playerRef.current = new yt.Player(container, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () => undefined,
        onStateChange: (event) => {
          if (event.data === yt.PlayerState.PLAYING) {
            saveProgress();
            stopTracking();
            intervalRef.current = setInterval(saveProgress, 5000);
          } else if (
            event.data === yt.PlayerState.PAUSED ||
            event.data === yt.PlayerState.ENDED
          ) {
            saveProgress();
            stopTracking();
          }
        },
      },
    });

    return () => {
      saveProgress();
      stopTracking();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [apiReady, saveProgress, stopTracking, videoId]);

  return (
    <>
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onLoad={() => handleScriptReady()}
        onReady={() => handleScriptReady()}
      />
      <div className="aspect-video w-full min-w-0 overflow-hidden rounded-2xl bg-slate-950">
        <div ref={containerRef} className="h-full w-full" title={title} />
      </div>
    </>
  );
}
