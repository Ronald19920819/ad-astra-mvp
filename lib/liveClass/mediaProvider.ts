import { isSubjectKey, type SubjectKey } from "@/lib/subjects/subjectConfig";

// Server-side Live Classroom media-provider resolution. Deliberately NOT
// marked "server-only": it touches no secret and no Supabase/cookies state
// (just two env vars plus the static subject config), so it stays pure and
// independently testable -- the "must be resolved server-side, never via
// NEXT_PUBLIC_" requirement is enforced structurally instead, by only ever
// calling this from the two Server Component classroom pages and passing
// just the resolved provider STRING down to client components (see
// SubjectLiveClassroomPage.tsx / TeacherSubjectLiveClassroomPage.tsx).
export type LiveClassMediaProvider = "cloudflare" | "livekit";

function parseLiveKitSubjectAllowlist(raw: string): Set<SubjectKey> {
  const keys = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is SubjectKey => isSubjectKey(entry));

  return new Set(keys);
}

// Cloudflare is the always-safe default and the full-rollback path:
//   - LIVE_CLASS_MEDIA_PROVIDER unset, empty, malformed, or explicitly
//     "cloudflare" -> every subject uses Cloudflare, regardless of the
//     allowlist below. Flipping (or removing) this one var instantly
//     reverts every subject at once.
//   - LIVE_CLASS_MEDIA_PROVIDER=livekit with LIVE_CLASS_LIVEKIT_SUBJECT_KEYS
//     unset/empty -> full rollout, every subject uses LiveKit.
//   - LIVE_CLASS_MEDIA_PROVIDER=livekit with LIVE_CLASS_LIVEKIT_SUBJECT_KEYS
//     set -> only the exact subject keys listed use LiveKit; every other
//     subject (including other stages/variants of the SAME family) stays on
//     Cloudflare. Removing a key from the list rolls just that subject back
//     without touching anything else.
export function getMediaProviderForSubject(
  subjectKey: SubjectKey,
): LiveClassMediaProvider {
  const rawProvider = process.env.LIVE_CLASS_MEDIA_PROVIDER?.trim().toLowerCase();

  if (rawProvider !== "livekit") {
    return "cloudflare";
  }

  const rawAllowlist = process.env.LIVE_CLASS_LIVEKIT_SUBJECT_KEYS?.trim();
  if (!rawAllowlist) {
    // The allowlist env var itself is entirely absent (or blank) -- treated
    // as "no allowlist configured", i.e. full rollout. This is distinct
    // from the allowlist being SET but containing no recognizable subject
    // keys (handled below), which must NOT be treated the same way --
    // otherwise a typo'd allowlist would silently widen from "one pilot
    // subject" to "every subject", which is exactly the kind of accidental
    // over-grant this config is meant to prevent.
    return "livekit";
  }

  const allowlist = parseLiveKitSubjectAllowlist(rawAllowlist);
  return allowlist.has(subjectKey) ? "livekit" : "cloudflare";
}
