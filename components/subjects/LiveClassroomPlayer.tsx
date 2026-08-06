"use client";

import { useState, type CSSProperties } from "react";

const TWITCH_CHANNEL = "tothestarsrep";
const TWITCH_PARENTS = [
  "localhost",
  "adastra.net.za",
  "www.adastra.net.za",
] as const;

function buildTwitchEmbedUrl() {
  const params = new URLSearchParams({
    channel: TWITCH_CHANNEL,
    autoplay: "false",
  });

  for (const parent of TWITCH_PARENTS) {
    params.append("parent", parent);
  }

  return `https://player.twitch.tv/?${params.toString()}`;
}

export function LiveClassroomPlayer({
  subjectColour,
  subjectSoftBackground,
}: {
  subjectColour: string;
  subjectSoftBackground: string;
}) {
  const [hasLoadError, setHasLoadError] = useState(false);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-sm">
      <div className="aspect-video w-full">
        <iframe
          key={buildTwitchEmbedUrl()}
          src={buildTwitchEmbedUrl()}
          title="AD Astra Live Classroom stream"
          className="h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          onError={() => setHasLoadError(true)}
        />
      </div>

      {hasLoadError && (
        <div
          className="border-t px-4 py-3 text-sm font-medium"
          style={
            {
              borderColor: `${subjectSoftBackground}66`,
              backgroundColor: `${subjectSoftBackground}22`,
              color: subjectColour,
            } as CSSProperties
          }
        >
          The live stream could not be loaded. Please refresh the page or try
          again shortly.
        </div>
      )}
    </div>
  );
}

export default LiveClassroomPlayer;


