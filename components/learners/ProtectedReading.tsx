"use client";

import type { CSSProperties } from "react";
import { StructuredReadingContent } from "@/components/readings/StructuredReadingContent";

type ProtectedReadingProps = {
  content: string | null;
  scrollable?: boolean;
};

export function ProtectedReading({
  content,
  scrollable = false,
}: ProtectedReadingProps) {
  return (
    <div
      aria-label="Lesson reading"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      className={`select-none rounded-2xl border border-orange-100 bg-[#FFFDF9] p-5 shadow-inner ${
        scrollable ? "max-h-[420px] overflow-y-auto" : ""
      }`}
      style={
        {
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        } as CSSProperties
      }
    >
      <StructuredReadingContent content={content} />
    </div>
  );
}
