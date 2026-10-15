import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Library } from "lucide-react";
import { ProtectedPdfReading } from "@/components/learners/ProtectedPdfReading";
import { resolveAuthorizedLibraryReading } from "@/lib/supabase/libraryPdfAccess";
import { isSubjectKey } from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

// AD ASTRA -- LIBRARY CLUB (STAGE C): the subject-scoped PDF viewing
// page. All authorization/resolution happens once, up front, via the
// shared resolveAuthorizedLibraryReading helper (the same one the
// download route uses) -- this page never queries lessons/lesson_materials
// itself and never trusts a materialId from anywhere but that helper's
// own result. Viewing itself reuses the EXISTING, UNMODIFIED
// ProtectedPdfReading/ProtectedPdfDocument components and the existing
// /api/lessons/[lessonId]/reading-pdf Classroom route (which independently
// re-authorizes again on its own, exactly as it already does for
// Classroom) -- nothing about Classroom's own reading behaviour changed.
export default async function LibraryClubLessonPage({
  params,
}: {
  params: Promise<{ subjectKey: string; lessonId: string }>;
}) {
  const { subjectKey: requestedSubjectKey, lessonId } = await params;

  if (!isSubjectKey(requestedSubjectKey)) {
    notFound();
  }

  const result = await resolveAuthorizedLibraryReading(
    requestedSubjectKey,
    lessonId,
  );

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-md lg:max-w-3xl">
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
            Unable to load this AD Astra &ndash; Library Club reading.
            Please try again.
          </p>
        </div>
      </main>
    );
  }

  const { reading } = result;
  const themeStyle = {
    "--subject-primary": reading.subject.colourTheme.primary,
    "--subject-soft": reading.subject.colourTheme.softBackground,
    "--subject-border": reading.subject.colourTheme.border,
  } as CSSProperties;

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 lg:px-8"
      style={themeStyle}
    >
      <div className="mx-auto max-w-md lg:max-w-3xl">
        <Link
          href={`/library/${reading.subject.key}`}
          prefetch={false}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]"
        >
          <ArrowLeft size={16} />
          Back to Library Club
        </Link>

        <section className="mb-5 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
              <Library size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-black/50">
                AD Astra &ndash; Library Club &bull; {reading.subject.displayName}
              </p>
              <h1 className="break-words text-xl font-bold text-[#102A43]">
                Lesson {reading.lessonNumber}
              </h1>
              <p className="break-words text-sm text-black/60">
                {reading.lessonTitle}
              </p>
            </div>
          </div>
        </section>

        <ProtectedPdfReading
          lessonId={reading.lessonId}
          materialId={reading.materialId}
        />

        <a
          href={`/api/library/${reading.subject.key}/${reading.lessonId}/download`}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[var(--subject-primary)] py-3 text-sm font-semibold text-white"
        >
          <Download size={18} />
          Download PDF
        </a>
      </div>
    </main>
  );
}
