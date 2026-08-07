"use client";

import { useMemo, useState, type CSSProperties } from "react";
import CloudflareWebRTCPlayer from "@/components/subjects/CloudflareWebRTCPlayer";

const CLOUDFLARE_STREAM_HOST = "customer-txjjmf9yh6vpwg3s.cloudflarestream.com";
const CLOUDFLARE_LIVE_INPUT_UID = "c13fb9977d632eecc10c4bc824ed7f40";

function buildCloudflareEmbedUrl() {
  return `https://${CLOUDFLARE_STREAM_HOST}/${CLOUDFLARE_LIVE_INPUT_UID}/iframe`;
}

function buildCloudflareWhepUrl() {
  return `https://${CLOUDFLARE_STREAM_HOST}/${CLOUDFLARE_LIVE_INPUT_UID}/webRTC/play`;
}

export function LiveClassroomPlayer({
  subjectColour,
  subjectSoftBackground,
}: {
  subjectColour: string;
  subjectSoftBackground: string;
}) {
  const [hasIframeLoadError, setHasIframeLoadError] = useState(false);
  const [useHlsFallback, setUseHlsFallback] = useState(false);

  const iframeUrl = useMemo(() => buildCloudflareEmbedUrl(), []);
  const whepUrl = useMemo(() => buildCloudflareWhepUrl(), []);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-sm">
      <div className="aspect-video w-full bg-slate-950">
        {useHlsFallback ? (
          <iframe
            key={iframeUrl}
            src={iframeUrl}
            title="AD Astra Live Classroom stream"
            className="h-full w-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            onError={() => setHasIframeLoadError(true)}
          />
        ) : (
          <CloudflareWebRTCPlayer
            whepUrl={whepUrl}
            onFailure={() => {
              setUseHlsFallback(true);
            }}
          />
        )}
      </div>

      {hasIframeLoadError ? (
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
      ) : null}
    </div>
  );
}

export default LiveClassroomPlayer;