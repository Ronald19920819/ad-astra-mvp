import type { MonthlyReportPayload } from "@/lib/reports/monthlyReportTypes";

// A cheap, dependency-free, non-cryptographic content hash used ONLY to
// detect when a report_snapshot has changed since Kingdom commentary was
// generated against it -- never for security. Deliberately NOT node:crypto
// so the exact same pure function runs both server-side (when generating
// and storing kingdom_comments.snapshotHash) and client-side (when the
// teacher UI checks whether already-generated comments are stale relative
// to what's currently on screen), with no async Web Crypto round-trip
// needed on the client.
//
// meta.generatedAt records WHEN a payload was computed, not academic/
// report EVIDENCE -- it is a fresh timestamp on every single call to
// generateMonthlyReportPreview, even when nothing about the learner's
// underlying lessons/activities/marks has changed at all (e.g. reopening
// a draft, or the teacher clicking Regenerate Comments a second time with
// no new evidence). If it were hashed in, this "is the report still
// current" signal would go spuriously stale on every recompute regardless
// of real change. Excluded here so the hash reflects only genuine
// evidence; every other field is either real evidence or an identity fact
// that legitimately should invalidate freshness if it somehow changed.
//
// AD ASTRA MONTHLY REPORT -- FINALISATION HASH-MISMATCH ROOT CAUSE:
// report_snapshot/kingdom_comments are stored in Postgres `jsonb` columns.
// jsonb does NOT preserve the original JS object-literal key insertion
// order -- confirmed empirically against real stored rows, Postgres
// returns object keys ordered by (length, then lexicographic), completely
// unrelated to the order generateMonthlyReportPreview's own `return {...}`
// wrote them in. Every code path that reads a payload BACK from the
// database (recomputeMonthlyReportDraftSnapshot's return value, the row
// the client receives after any mutation) therefore has different key
// ORDER than a payload generateMonthlyReportPreview just built fresh in
// memory and never persisted (e.g. finalizeMonthlyReport's own recompute,
// hashed directly without a DB round trip) -- even when the DATA is 100%
// identical. Because JSON.stringify is key-order-sensitive, hashing the
// object as-is made kingdom_comments.snapshotHash (computed from a
// jsonb-round-tripped payload) permanently unable to match a fresh
// in-memory recompute's hash, regardless of how many times commentary was
// regenerated. The fix is to canonicalise: recursively sort every
// object's keys (arrays keep their real, meaningful order -- only object
// KEY order is a serialisation artefact) before stringifying, so the hash
// is invariant to whichever key order the object happens to carry.
function canonicaliseForHashing(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicaliseForHashing);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const canonical: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      canonical[key] = canonicaliseForHashing(record[key]);
    }
    return canonical;
  }
  return value;
}

export function hashMonthlyReportSnapshot(payload: MonthlyReportPayload): string {
  const stableMeta: Partial<MonthlyReportPayload["meta"]> = { ...payload.meta };
  delete stableMeta.generatedAt;
  const serialised = JSON.stringify(canonicaliseForHashing({ ...payload, meta: stableMeta }));
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let index = 0; index < serialised.length; index += 1) {
    hash ^= serialised.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
