"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { neueHaas } from "@/app/fonts";
import type { LearnerReturnedFeedbackItem } from "@/lib/supabase/learnerReturnedFeedback";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import {
  formatReviewedDate,
  resolveDisplayedTeacherComment,
  resolvePerformanceBadge,
  resolveTeacherAttribution,
} from "@/lib/home/teacherFeedbackPresentation";

const PREVIOUS_ARROW = "‹";
const NEXT_ARROW = "›";
const STARFIELD_BACKGROUND_SRC = "/backgrounds/feedback/feedback-starfield.png";

export function TeacherFeedbackCard({
  feedback,
  learnerFirstName,
}: {
  feedback: LearnerReturnedFeedbackItem[];
  learnerFirstName: string;
}) {
  const [active, setActive] = useState(0);
  const startX = useRef(0);

  const hasFeedback = feedback.length > 0;
  const current = hasFeedback ? feedback[active] : null;
  const isFirst = active === 0;
  const isLast = active === feedback.length - 1;

  // Deliberately clamped, not wraparound (unlike the old MotivationalCard's
  // previousQuote/nextQuote): this is a finite, newest-first list of real
  // reviewed work, so "next" wrapping from the newest item back to the
  // oldest would be disorienting rather than helpful.
  const previousFeedback = () => {
    setActive((currentIndex) => Math.max(0, currentIndex - 1));
  };

  const nextFeedback = () => {
    setActive((currentIndex) => Math.min(feedback.length - 1, currentIndex + 1));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const difference = startX.current - event.clientX;
    if (difference > 40) nextFeedback();
    if (difference < -40) previousFeedback();
  };

  const subject = current ? getSubjectConfigurationByDatabaseId(current.subjectId) : null;
  const badge = current ? resolvePerformanceBadge(current.finalMark, current.totalMarks) : null;

  return (
    <div
      className="relative mb-5 overflow-hidden rounded-[2rem] shadow-md lg:min-h-[168px]"
      onPointerDown={hasFeedback ? handlePointerDown : undefined}
      onPointerUp={hasFeedback ? handlePointerUp : undefined}
      style={{ touchAction: "pan-y" }}
    >
      {/* The permanent starfield background covers the whole card; a navy
          gradient overlay on top keeps white text/gold accents readable
          without hiding the stars entirely (stronger over the text corner,
          lighter toward the badge corner, in both the stacked-mobile and
          two-column-desktop layouts). */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${STARFIELD_BACKGROUND_SRC})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0B1B33]/95 via-[#0B1B33]/80 to-[#0B1B33]/45"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col px-6 py-6 lg:grid lg:grid-cols-[65%_35%] lg:gap-x-6 lg:px-8 lg:py-8">
        <div className="order-1 lg:col-start-1">
          <h2 className={`${neueHaas.className} text-xl font-bold text-white lg:text-2xl`}>
            {current
              ? `Here's how you did, ${learnerFirstName}`
              : `Feedback for ${learnerFirstName}`}
          </h2>
          {current ? (
            <p className="mt-1 text-sm font-semibold text-[#FEC20C]">
              {resolveTeacherAttribution(current.teacherFirstName)}
            </p>
          ) : null}
        </div>

        {!current ? (
          <div className="order-2 mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 lg:col-start-1">
            <p className="text-sm font-medium leading-6 text-white/80">
              Once one of your activities has been reviewed, your teacher&apos;s
              feedback will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="order-2 mt-4 flex flex-wrap items-center gap-2 lg:col-start-1">
              {subject ? (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: subject.colourTheme.softBackground,
                    color: subject.colourTheme.primary,
                  }}
                >
                  {current.subjectName}
                </span>
              ) : null}
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
                {current.activityTitle}
              </span>
            </div>

            {/* The performance badge: on desktop this occupies the large
                right-hand ~35% column, spanning and vertically centred
                against the whole left content block; on mobile it falls
                naturally between the activity line and the comment (see
                the order-* utilities). It sits directly over the
                starfield -- no surrounding box, no repeated tier label. */}
            {badge ? (
              <div className="order-3 mt-5 flex items-center justify-center lg:col-start-2 lg:row-start-1 lg:row-end-5 lg:mt-0 lg:self-stretch">
                <div className="flex h-full items-center justify-center">
                  <Image
                    src={badge.imageSrc}
                    alt={badge.altText}
                    width={190}
                    height={190}
                    className="h-[120px] w-[120px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.45)] sm:h-[140px] sm:w-[140px] lg:h-[170px] lg:w-[170px]"
                    unoptimized
                  />
                </div>
              </div>
            ) : null}

            <div className="order-4 mt-4 lg:col-start-1">
              <div className="max-h-32 overflow-y-auto rounded-2xl border border-white/15 bg-[#0B1B33]/60 px-4 py-3 backdrop-blur-sm">
                <p className="whitespace-pre-wrap break-words text-sm italic leading-6 text-white/90">
                  &ldquo;{resolveDisplayedTeacherComment(current.teacherComment)}&rdquo;
                </p>
              </div>
              <p className="mt-2 text-xs font-medium text-white/50">
                Reviewed {formatReviewedDate(current.reviewedAt)}
              </p>
            </div>

            <div className="order-5 lg:col-start-1">
              <Link
                href={`/your-work/${current.submissionId}`}
                className="mt-4 inline-flex items-center justify-center gap-1 rounded-full bg-[#FEC20C] px-5 py-2.5 text-sm font-bold text-[#102A43] shadow-sm transition hover:brightness-95"
              >
                View My Reviewed Work
                <span aria-hidden="true">&rarr;</span>
              </Link>

              <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={previousFeedback}
                  disabled={isFirst}
                  className="text-2xl font-light text-white/80 disabled:opacity-30"
                  aria-label="Previous feedback"
                >
                  {PREVIOUS_ARROW}
                </button>
                <span className="text-xs font-semibold text-white/60">
                  {active + 1} of {feedback.length}
                </span>
                <button
                  type="button"
                  onClick={nextFeedback}
                  disabled={isLast}
                  className="text-2xl font-light text-white/80 disabled:opacity-30"
                  aria-label="Next feedback"
                >
                  {NEXT_ARROW}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
