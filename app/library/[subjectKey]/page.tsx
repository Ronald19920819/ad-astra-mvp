import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Library } from "lucide-react";
import {
  getAuthenticatedLearnerLibraryForSubject,
  type LibraryClubTerm,
} from "@/lib/supabase/libraryReadings";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  isSubjectKey,
} from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

// AD ASTRA -- LIBRARY CLUB (STAGE B, catalogue wired to real actions in
// STAGE C): "AD Astra -- Library Club" is the one universal learner-
// facing name for this feature across every subject (locked product
// decision) -- only the subject identity below it changes per subject.
// There is intentionally no global /library bookshelf route; a learner
// only ever reaches this page from the subject dashboard they are
// already viewing, so subjectKey always comes from that dashboard's own
// canonical subject, never typed/guessed.
//
// "unknown_subject" and "not_enrolled" both resolve to the same plain
// notFound() -- collapsing them is deliberate, not an oversight: it
// means this page never reveals to a learner whether a given key is a
// real-but-forbidden subject versus a nonexistent one, matching the
// established notFound()-for-both convention already used by
// TeacherSubjectSubmissionReviewPage for an analogous invalid-vs-
// forbidden distinction.
//
// STAGE C: View links to /library/[subjectKey]/[lessonId] (its own page
// independently re-authorizes via the same resolveAuthorizedLibraryReading
// helper the download route uses -- this catalogue listing never
// generates a signed URL or fetches file bytes itself). Download links
// directly to the authorized download API route. Neither action is
// generated until the learner actually clicks it.

function resolveDefaultOpenTermIndex(terms: LibraryClubTerm[]): number {
  for (let index = terms.length - 1; index >= 0; index -= 1) {
    if (terms[index].termNumber !== null) return index;
  }
  // Only reached when every term in the result is the null-term group
  // (i.e. there is exactly one entry, "Other Coursework") -- open it.
  return terms.length - 1;
}

function formatTermLabel(termNumber: number | null) {
  return termNumber === null ? "Other Coursework" : `Term ${termNumber}`;
}

export default async function LibraryClubSubjectPage({
  params,
}: {
  params: Promise<{ subjectKey: string }>;
}) {
  const { subjectKey: requestedSubjectKey } = await params;

  if (!isSubjectKey(requestedSubjectKey)) {
    notFound();
  }

  const result = await getAuthenticatedLearnerLibraryForSubject(
    requestedSubjectKey,
  );

  if (result.status === "unknown_subject" || result.status === "not_enrolled") {
    notFound();
  }

  const subject = getSubjectConfiguration(requestedSubjectKey);
  const themeStyle = {
    "--subject-primary": subject.colourTheme.primary,
    "--subject-soft": subject.colourTheme.softBackground,
    "--subject-border": subject.colourTheme.border,
  } as CSSProperties;

  if (result.status === "unauthenticated") {
    return (
      <main
        className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 lg:px-8"
        style={themeStyle}
      >
        <div className="mx-auto max-w-md lg:max-w-6xl">
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
            Unable to load your AD Astra &ndash; Library Club. Please try again.
          </p>
        </div>
      </main>
    );
  }

  const { library } = result;
  const defaultOpenIndex = resolveDefaultOpenTermIndex(library.terms);

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-6 py-6 lg:px-8"
      style={themeStyle}
    >
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <Link
          href={buildSubjectRoute(subject, "learnerDashboard")}
          prefetch={false}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]"
        >
          <ArrowLeft size={16} />
          Back to {subject.displayName}
        </Link>

        <section className="mb-6 rounded-[2rem] border border-[var(--subject-border)] bg-white p-5 shadow-sm lg:p-7">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
              <Library size={24} />
            </div>
            <h1 className="text-2xl font-bold text-[#102A43] lg:text-3xl">
              AD Astra &ndash; Library Club
            </h1>
          </div>

          <div className="mt-4 border-t border-[var(--subject-border)] pt-4">
            <h2 className="text-lg font-bold text-[#102A43]">
              {subject.displayName}
            </h2>
            <p className="mt-1 text-sm font-medium text-black/60">
              {subject.framework} {subject.defaultStageOrGrade}
            </p>
          </div>
        </section>

        <h3 className="mb-4 px-1 text-sm font-bold uppercase tracking-wide text-black/50">
          Your Coursework
        </h3>

        {library.terms.length === 0 ? (
          <section className="rounded-[2rem] border border-[var(--subject-border)] bg-white p-6 text-center shadow-sm">
            <p className="text-base font-bold text-[#102A43]">
              Coursework is coming.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black/60">
              Your study materials will appear here as new coursework
              becomes available.
            </p>
          </section>
        ) : (
            <div className="space-y-4">
              {library.terms.map((term, index) => (
                <details
                  key={term.termNumber ?? "other-coursework"}
                  open={index === defaultOpenIndex}
                  className="group overflow-hidden rounded-[2rem] border border-[var(--subject-border)] bg-white shadow-sm"
                >
                  <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 p-5 text-left marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="text-lg font-bold text-[#102A43]">
                      {formatTermLabel(term.termNumber)}
                    </span>
                    <ChevronDown
                      size={20}
                      className="shrink-0 text-[var(--subject-primary)] transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="space-y-6 border-t border-[var(--subject-border)] p-5">
                    {term.topics.map((topic) => (
                      <div key={topic.topicId ?? "general"}>
                        <h4 className="mb-3 border-b border-[var(--subject-border)] pb-2 text-sm font-bold uppercase tracking-wide text-[var(--subject-primary)]">
                          {topic.topicTitle}
                        </h4>

                        <div className="space-y-3">
                          {topic.lessons.map((lesson) => (
                            <div
                              key={lesson.lessonId}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="min-w-0">
                                <span className="inline-block rounded-full bg-[var(--subject-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--subject-primary)]">
                                  PDF
                                </span>
                                <p className="mt-1 break-words text-sm font-bold text-slate-900">
                                  Lesson {lesson.lessonNumber}
                                </p>
                                <p className="break-words text-sm text-slate-600">
                                  {lesson.title}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <Link
                                  href={`/library/${subject.key}/${lesson.lessonId}`}
                                  prefetch={false}
                                  className="rounded-full border border-[var(--subject-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--subject-primary)]"
                                >
                                  View
                                </Link>
                                <a
                                  href={`/api/library/${subject.key}/${lesson.lessonId}/download`}
                                  className="rounded-full bg-[var(--subject-primary)] px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
        )}
      </div>
    </main>
  );
}
