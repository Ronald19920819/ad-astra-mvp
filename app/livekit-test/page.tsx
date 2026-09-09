"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { neueHaas } from "@/app/fonts";
import LiveKitTestViewer from "@/components/livekit-test/LiveKitTestViewer";

// Isolated LiveKit proof-of-concept page. Not linked from any production
// navigation and does not touch the Cloudflare-based Live Classroom (chat,
// attendance, raise hand, presence, sounds, or subject routes).
type ConnectionDetails = {
  token: string;
  url: string;
};

export default function LiveKitTestPage() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchTestToken() {
      try {
        const response = await fetch("/api/livekit/test-token", {
          method: "POST",
          credentials: "same-origin",
        });

        const result = (await response.json()) as
          | { token?: string; url?: string; error?: string }
          | null;

        if (!response.ok || !result?.token || !result?.url) {
          throw new Error(result?.error || "Unable to join the LiveKit test room.");
        }

        if (!cancelled) {
          setConnectionDetails({ token: result.token, url: result.url });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error && error.message
              ? error.message
              : "Unable to join the LiveKit test room.",
          );
        }
      }
    }

    void fetchTestToken();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="mx-auto w-full max-w-md min-w-0 md:max-w-2xl">
        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-[#102A43]">AD Astra LiveKit Test</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Isolated media proof of concept -- separate from the production Live
            Classroom.
          </p>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          {loadError ? (
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
          ) : !connectionDetails ? (
            <p className="text-sm font-medium text-slate-500">Connecting...</p>
          ) : (
            <LiveKitRoom
              serverUrl={connectionDetails.url}
              token={connectionDetails.token}
              connect
              audio={false}
              video={false}
            >
              <LiveKitTestViewer />
            </LiveKitRoom>
          )}
        </section>
      </div>
    </main>
  );
}
