"use client";

import dynamic from "next/dynamic";

const ProtectedPdfDocument = dynamic(
  () =>
    import("@/components/learners/ProtectedPdfDocument").then(
      (module) => module.ProtectedPdfDocument,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="rounded-2xl bg-slate-100 p-6 text-center text-sm font-semibold text-slate-600">
        Loading PDF reading...
      </p>
    ),
  },
);

export function ProtectedPdfReading({
  lessonId,
  materialId,
  sourceUrl,
}: {
  lessonId?: string;
  materialId?: string;
  sourceUrl?: string;
}) {
  const resolvedSourceUrl =
    sourceUrl ??
    (lessonId && materialId
      ? `/api/lessons/${encodeURIComponent(lessonId)}/reading-pdf?materialId=${encodeURIComponent(materialId)}`
      : null);

  if (!resolvedSourceUrl) return null;

  return <ProtectedPdfDocument sourceUrl={resolvedSourceUrl} />;
}
