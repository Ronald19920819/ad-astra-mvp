"use client";

import { useState, type CSSProperties } from "react";

const CLOUDFLARE_STREAM_HOST = "customer-txjjmf9yh6vpwg3s.cloudflarestream.com";
const CLOUDFLARE_LIVE_INPUT_UID = "c13fb9977d632eecc10c4bc824ed7f40";

function buildCloudflareEmbedUrl() {
  return `https://${CLOUDFLARE_STREAM_HOST}/${CLOUDFLARE_LIVE_INPUT_UID}/iframe`;
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
          key={buildCloudflareEmbedUrl()}
          src={buildCloudflareEmbedUrl()}
          title="AD Astra Live Classroom stream"
          className="h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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
