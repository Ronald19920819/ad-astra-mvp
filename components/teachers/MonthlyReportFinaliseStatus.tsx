// AD ASTRA MONTHLY REPORT -- STAGE 4B: THE ONE canonical finalisation-
// readiness UI. Deliberately extracted into its own small, dependency-
// light component (no next/font/local, no next/image, no data fetching)
// so it can be exercised with a REAL React render in a plain node:test
// run via react-dom/server -- proving the "stale warning and Finalise
// Report can never coexist" invariant against actual rendered output,
// not just a regex over the source text.
//
// There is exactly one place in the whole report preview that renders
// finalisation-readiness information. Earlier revisions had a SEPARATE
// stale-warning banner elsewhere in the page in addition to this status
// block; both read the same underlying signal, but their existence as
// two independently-positioned JSX branches was itself part of what made
// this area hard to reason about. Consolidating into one component
// rendered once removes that possibility structurally, not just by
// convention.

export type CommentaryFreshness = "no_commentary" | "stale" | "fresh";

// The ONE canonical freshness derivation. "no_commentary" when nothing
// has been generated yet; "stale" when commentary exists but no longer
// matches the current report snapshot's hash; "fresh" otherwise. A
// fourth state -- finalised -- is handled separately by the caller (via
// isFinalised), since a finalised report has no "commentary readiness"
// concept left to evaluate.
export function deriveCommentaryFreshness(
  hasDisplayedComments: boolean,
  commentsStale: boolean,
): CommentaryFreshness {
  if (!hasDisplayedComments) return "no_commentary";
  return commentsStale ? "stale" : "fresh";
}

export function MonthlyReportFinaliseStatus({
  isFinalised,
  finalisedAt,
  commentaryFreshness,
  finalizing,
  finalizeError,
  onFinalize,
}: {
  isFinalised: boolean;
  finalisedAt: string | null;
  commentaryFreshness: CommentaryFreshness;
  finalizing: boolean;
  finalizeError: string;
  onFinalize: () => void;
}) {
  if (isFinalised) {
    return (
      <div className="rounded-2xl border border-[#102A43]/20 bg-[#102A43]/5 p-4">
        <p className="text-sm font-bold text-[#102A43]">Finalised</p>
        <p className="mt-1 text-xs text-slate-600">
          This report was finalised
          {finalisedAt
            ? ` on ${new Date(finalisedAt).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`
            : ""}{" "}
          and is now the official, frozen record for this reporting period. It can no longer be
          edited or regenerated.
        </p>
      </div>
    );
  }

  if (commentaryFreshness === "fresh") {
    return (
      <div>
        {finalizeError ? (
          <p className="mb-3 text-xs font-semibold text-red-600">{finalizeError}</p>
        ) : null}
        <button
          type="button"
          onClick={onFinalize}
          disabled={finalizing}
          className="rounded-2xl bg-[#FEC20C] px-6 py-3 text-sm font-bold text-[#102A43] shadow-sm disabled:opacity-50"
        >
          {finalizing ? "Finalising…" : "Finalise Report"}
        </button>
      </div>
    );
  }

  if (commentaryFreshness === "stale") {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
        This report&apos;s content has changed since Kingdom&apos;s commentary was generated.
        Regenerate Report Comments before finalising.
      </p>
    );
  }

  return (
    <p className="text-xs text-slate-500">
      Generate Report Comments above before this report can be finalised.
    </p>
  );
}
