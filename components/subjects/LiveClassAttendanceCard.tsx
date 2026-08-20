"use client";

import { Hand, Users } from "lucide-react";
import type { LearnerPresenceInfo } from "@/components/subjects/LiveClassChatPanel";

// Teacher-only attendance roster. Raise Hand itself now lives directly
// beneath the video (see LiveClassroomWorkspace.tsx) rather than here --
// this card is rendered only for role === "teacher".
export function LiveClassAttendanceCard({
  subjectColour,
  subjectSoftBackground,
  learners,
  onClearHand,
}: {
  subjectColour: string;
  subjectSoftBackground: string;
  learners: LearnerPresenceInfo[];
  onClearHand?: (learnerProfileId: string) => void;
}) {
  const raisedCount = learners.filter((learner) => learner.raisedHand).length;

  return (
    <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="rounded-2xl p-3"
            style={{
              backgroundColor: subjectSoftBackground,
              color: subjectColour,
            }}
          >
            <Users size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#102A43]">Attendance</h2>
            <p className="text-sm text-slate-500">
              Learners currently present in this live lesson.
            </p>
          </div>
        </div>

        <span
          aria-live="polite"
          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: subjectSoftBackground, color: subjectColour }}
        >
          {learners.length === 0
            ? "No learners present"
            : learners.length === 1
              ? "1 learner present"
              : `${learners.length} learners present`}
        </span>
      </div>

      {learners.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          No learners are currently present.
        </p>
      ) : (
        <div>
          {raisedCount > 0 ? (
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              {raisedCount === 1 ? "1 hand raised" : `${raisedCount} hands raised`}
            </p>
          ) : null}
          <ul className="space-y-2">
            {learners.map((learner) => (
              <li
                key={learner.profileId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                  {learner.displayName}
                </span>

                {learner.raisedHand ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ backgroundColor: subjectSoftBackground, color: subjectColour }}
                    >
                      <Hand size={13} />
                      Hand Raised
                    </span>
                    <button
                      type="button"
                      onClick={() => onClearHand?.(learner.profileId)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    Online
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default LiveClassAttendanceCard;
