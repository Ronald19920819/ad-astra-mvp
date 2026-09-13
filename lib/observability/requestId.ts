import { headers } from "next/headers";

// No "server-only" import here (unlike most of this app's server-side
// Supabase helpers): REQUEST_ID_HEADER is imported directly by proxy.ts,
// which runs in Next's separate Proxy bundle, not a Server
// Component/Route Handler bundle -- "server-only" guards against client
// bundling only, but keeping this file import-safe for every server-side
// context (proxy included) avoids relying on that distinction. Nothing
// here is ever exported to or imported from client code.

// DIAGNOSTICS ONLY. proxy.ts generates a short correlation ID for every
// matched request and overwrites (never trusts) any client-supplied
// value of this header, so a single request's proxy-stage and
// page-stage log lines can be correlated without exposing any
// session/cookie/token/user-identifying data. This value must never be
// used for authentication or authorization -- nothing downstream reads
// it for any decision, only for labelling a log line.
export const REQUEST_ID_HEADER = "x-ad-astra-request-id";

// Missing entirely (a request that somehow bypassed proxy.ts, or a
// context where headers() is unavailable) must never throw and must
// never affect authentication -- it just means the resulting log line
// has no correlation id.
export async function getDiagnosticRequestId(): Promise<string | null> {
  try {
    const headerStore = await headers();
    return headerStore.get(REQUEST_ID_HEADER);
  } catch {
    return null;
  }
}
