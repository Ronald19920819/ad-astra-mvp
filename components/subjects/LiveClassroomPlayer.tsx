"use client";

import { useMemo, useState, type CSSProperties } from "react";
import CloudflareWebRTCPlayer, {
  type CloudflarePlaybackDiagnostics,
} from "@/components/subjects/CloudflareWebRTCPlayer";

const CLOUDFLARE_STREAM_HOST = "customer-txjjmf9yh6vpwg3s.cloudflarestream.com";
const CLOUDFLARE_LIVE_INPUT_UID = "c13fb9977d632eecc10c4bc824ed7f40";

function buildCloudflareEmbedUrl() {
  return `https://${CLOUDFLARE_STREAM_HOST}/${CLOUDFLARE_LIVE_INPUT_UID}/iframe`;
}

function buildCloudflareWhepUrl() {
  return `https://${CLOUDFLARE_STREAM_HOST}/${CLOUDFLARE_LIVE_INPUT_UID}/webRTC/play`;
}

function soundLabel(diagnostics: CloudflarePlaybackDiagnostics | null) {
  if (!diagnostics) return "Checking";
  if (diagnostics.status === "waiting-for-user") return "Muted / Join required";
  return diagnostics.muted ? "Muted" : "On";
}

function trackLabel(count: number | null, kind: "audio" | "video") {
  if (count === null) return `${kind === "audio" ? "Audio" : "Video"} pending`;
  return count > 0 ? "Detected" : "Not detected";
}

export function LiveClassroomPlayer({
  subjectColour,
  subjectSoftBackground,
  requireExplicitAudioJoin = false,
  showLearnerSupportInfo = false,
}: {
  subjectColour: string;
  subjectSoftBackground: string;
  requireExplicitAudioJoin?: boolean;
  showLearnerSupportInfo?: boolean;
}) {
  const [hasIframeLoadError, setHasIframeLoadError] = useState(false);
  const [useHlsFallback, setUseHlsFallback] = useState(false);
  const [supportInfoExpanded, setSupportInfoExpanded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CloudflarePlaybackDiagnostics | null>(null);

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
            requireExplicitAudioJoin={requireExplicitAudioJoin}
            onDiagnosticsChange={setDiagnostics}
            onFailure={() => {
              setUseHlsFallback(true);
            }}
          />
        )}
      </div>

      {showLearnerSupportInfo ? (
        <div className="border-t border-slate-800 bg-white px-4 py-3 text-sm text-slate-700">
          <button
            type="button"
            aria-expanded={supportInfoExpanded}
            onClick={() => setSupportInfoExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              outlineColor: subjectColour,
            }}
          >
            <span>Connection info</span>
            <span className="text-xs font-medium text-slate-500">
              {supportInfoExpanded ? "Hide" : "Show"}
            </span>
          </button>

          {supportInfoExpanded ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-medium text-slate-500">Playback</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {useHlsFallback ? "Backup stream (HLS)" : "Low latency (WebRTC)"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-medium text-slate-500">Sound</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {useHlsFallback ? "Use backup player controls" : soundLabel(diagnostics)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-medium text-slate-500">Audio track</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {useHlsFallback
                    ? "Unavailable in backup mode"
                    : trackLabel(diagnostics?.audioTrackCount ?? null, "audio")}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-medium text-slate-500">Video track</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {useHlsFallback
                    ? "Unavailable in backup mode"
                    : trackLabel(diagnostics?.videoTrackCount ?? null, "video")}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-medium text-slate-500">Connection</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {useHlsFallback
                    ? "Backup stream active"
                    : diagnostics?.connectionState ?? diagnostics?.status ?? "Checking"}
                </dd>
              </div>
              {!useHlsFallback ? (
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-medium text-slate-500">ICE</dt>
                  <dd className="text-right font-semibold text-slate-800">
                    {diagnostics?.iceConnectionState ?? "Checking"}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}

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