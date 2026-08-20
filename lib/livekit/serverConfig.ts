import "server-only";

// Isolated from the existing Cloudflare WHEP live-player configuration
// (CloudflareWebRTCPlayer.tsx / LiveClassroomPlayer.tsx) -- this helper is
// used by the LiveKit proof-of-concept AND the production Stage 1
// subject-room/token foundation. It never touches production Live Classroom
// UI/render code paths.
export type LiveKitServerConfig = {
  // https://... host for server-side LiveKit API calls (AccessToken minting
  // needs only the key/secret, but IngressClient/RoomServiceClient need this
  // as their `host` argument).
  apiUrl: string;
  // wss://... URL the BROWSER connects to. Safe to return from an API route
  // (it is a connection endpoint, not a secret), unlike apiKey/apiSecret.
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
};

// During the LiveKit POC, passing a wss:// value as the server SDK's API
// host produced a real "401 Unauthorized: invalid API key" failure against
// the Ingress API -- so this helper does NOT rely on the SDK's own
// ws->http normalization for production. LIVEKIT_API_URL (https://...) and
// LIVEKIT_WS_URL (wss://...) should be set explicitly. LIVEKIT_URL remains
// supported as a LOCAL-DEV-ONLY fallback (used verbatim for both purposes,
// matching the POC's original single-var setup) so existing local .env.local
// files don't break; any environment that talks to the LiveKit server API
// directly should set the explicit vars instead.
//
// LIVEKIT_API_SECRET (and the API key) must never be exposed to the
// browser: no NEXT_PUBLIC_ prefix, never returned from an API route, never
// logged. Only LiveKit's own server SDK classes (AccessToken, IngressClient)
// consume the values returned here, server-side only.
export function getLiveKitServerConfig(): LiveKitServerConfig {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const legacyUrl = process.env.LIVEKIT_URL?.trim();
  const apiUrl = process.env.LIVEKIT_API_URL?.trim() || legacyUrl;
  const wsUrl = process.env.LIVEKIT_WS_URL?.trim() || legacyUrl;

  if (!apiUrl || !wsUrl || !apiKey || !apiSecret) {
    throw new Error(
      "LiveKit is not configured: set LIVEKIT_API_URL (https://...) and LIVEKIT_WS_URL (wss://...) -- or LIVEKIT_URL as a local-dev-only fallback for both -- plus LIVEKIT_API_KEY and LIVEKIT_API_SECRET, in the server environment.",
    );
  }

  return { apiUrl, wsUrl, apiKey, apiSecret };
}
