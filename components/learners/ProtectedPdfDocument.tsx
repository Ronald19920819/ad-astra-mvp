"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function ProtectedPdfDocument({
  sourceUrl,
}: {
  sourceUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl bg-slate-100">
      <div
        ref={containerRef}
        className="h-[72vh] min-h-[24rem] max-h-[80svh] overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:h-[75vh] lg:h-[78vh] lg:max-h-[880px]"
      >
        <Document
          file={sourceUrl}
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
          loading={<p className="p-6 text-center text-sm font-semibold text-slate-600">Loading PDF reading...</p>}
          error={<p className="p-6 text-center text-sm font-semibold text-red-600">This PDF reading could not be displayed.</p>}
          className="space-y-3"
        >
          {containerWidth > 0 &&
            Array.from({ length: pageCount }, (_, index) => (
              <Page
                key={index + 1}
                pageNumber={index + 1}
                width={Math.max(1, containerWidth - 24)}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="mx-auto overflow-hidden bg-white shadow-sm"
              />
            ))}
        </Document>
      </div>
    </div>
  );
}
