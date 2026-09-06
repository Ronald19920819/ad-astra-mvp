"use client";

import Image from "next/image";
import { neueHaas } from "@/app/fonts";
import { formatReportMonthLabel } from "@/lib/reports/monthlyReportMonth";
import type { KingdomMonthlyReportComments } from "@/lib/reports/kingdomMonthlyReport";
import type { MonthlyReportPayload } from "@/lib/reports/monthlyReportTypes";
import { resolveMonthlyReportBadgeAsset } from "@/lib/reports/monthlyReportBadgeAsset";
import {
  GlanceStat,
  academicBasisSummary,
  activityStatusLabel,
  activityStatusTone,
  formatOnTimeWork,
  formatPercentage,
  formatRate,
  lessonStatusLabel,
  lessonStatusTone,
} from "@/components/teachers/MonthlyReportGenerator";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK. The
// unauthenticated, read-only view rendered at /report/[token]. Reuses
// the exact same pure formatting helpers as the teacher-facing preview
// (components/teachers/MonthlyReportGenerator.tsx) so a recipient sees
// numbers and labels that are identical to what the teacher approved --
// but this component itself renders NONE of that file's controls:
// no selection, no editing, no comment generation/regeneration, no
// finalise/send/link actions, no internal status text. It receives only
// the frozen report_snapshot and the already-resolved approved
// commentary -- it never fetches anything and never talks to the
// Monthly Report engine.
//
// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
// Deliberately marked "use client": components/teachers/
// MonthlyReportGenerator.tsx (whose pure formatting helpers this view
// reuses, per the header comment above) is itself a "use client" module.
// A Next.js Server Component that imports plain values/functions from a
// "use client" module does NOT get the real implementation -- it gets an
// opaque client-reference placeholder, since a "use client" file's entire
// export surface is rewritten into React Server Component references,
// not just its default/component export. That mismatch was the actual
// root cause of the "badge is undefined" crash: the badge-to-asset map,
// indexed on the server, silently resolved to undefined rather than the
// real asset map. Rendering this view as a Client Component (its props --
// the frozen report_snapshot and resolved comments -- are plain,
// serializable JSON, exactly what "use client" requires) puts every
// import here on the same side of the boundary as its source module,
// which is the only way this reuse is actually safe.
export function PublicMonthlyReportView({
  report,
  comments,
}: {
  report: MonthlyReportPayload;
  comments: KingdomMonthlyReportComments | null;
}) {
  // Resolved via the one canonical resolver (see monthlyReportBadgeAsset.ts)
  // rather than a direct lookup: this report_snapshot is a FROZEN
  // historical jsonb blob and its badge.key can never be assumed to still
  // match a currently-known badge key -- null is a real, expected outcome
  // that must render a neutral fallback below, never crash.
  const badge = resolveMonthlyReportBadgeAsset(report.badge?.key);

  const evidenceWarnings: string[] = [];
  if (report.evidenceFlags.unreviewedSubmissionsPresent) {
    const count = report.engagement.activitiesAwaitingReview;
    evidenceWarnings.push(
      `${count} activit${count === 1 ? "y is" : "ies are"} awaiting teacher review and not yet reflected in the academic average.`,
    );
  }
  if (report.evidenceFlags.insufficientMarkedEvidence) {
    evidenceWarnings.push(
      "Academic judgement is based on limited evidence (fewer than 4 teacher-reviewed activities).",
    );
  }
  if (report.evidenceFlags.lowCompletionRatio) {
    evidenceWarnings.push("Activity completion for this period is below 50%.");
  }
  if (report.evidenceFlags.substantialOutstandingWork) {
    evidenceWarnings.push("A substantial amount of selected work remains outstanding.");
  }
  if (report.evidenceFlags.insufficientForTrend) {
    evidenceWarnings.push("There is not yet enough evidence to identify a performance trend.");
  }
  if (report.evidenceFlags.topicCoverageGaps.length > 0) {
    evidenceWarnings.push(
      `No teacher-reviewed evidence yet for: ${report.evidenceFlags.topicCoverageGaps.join(", ")}.`,
    );
  }

  const returnedActivityCount = report.activities.filter(
    (activity) => activity.hasAuthoritativeMark,
  ).length;

  return (
    <div className="min-h-full bg-[#EEF7FF] px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] shadow-lg">
        <div className="relative bg-[#102A43] px-6 py-5 text-white lg:px-10 lg:py-6">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: "#FEC20C" }}
            aria-hidden="true"
          />
          <div className="flex flex-col items-center gap-4 text-center lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6 lg:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#FEC20C]">
                Monthly Progress Report
              </p>
              <h1 className={`${neueHaas.className} mt-1 text-2xl font-bold text-white lg:text-3xl`}>
                {report.meta.learnerName}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/70">
                {report.meta.subjectName} · {formatReportMonthLabel(report.meta.reportMonth)}
              </p>
              <p className="mt-1 text-xs font-medium text-white/50">
                Subject Teacher: {report.meta.teacherName ?? "Not available"}
              </p>
            </div>

            <Image
              src="/ad_astra_logo.png"
              alt="AD Astra Logo"
              width={160}
              height={160}
              unoptimized
              className="h-16 w-16 object-contain lg:h-20 lg:w-20"
            />

            <div className="flex justify-center lg:justify-end">
              {badge ? (
                <Image
                  src={badge.src}
                  alt={badge.alt}
                  width={140}
                  height={140}
                  unoptimized
                  className="h-14 w-14 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.45)] lg:h-16 lg:w-16"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-white p-6 lg:p-10">
          <div>
            <h2 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
              At a Glance
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <GlanceStat
                label="Lessons Completed"
                value={`${report.engagement.lessonsCompleted} of ${report.engagement.lessonsSelected}`}
              />
              <GlanceStat
                label="Activities Submitted"
                value={`${report.engagement.activitiesSubmitted} of ${report.engagement.activitiesSelected}`}
              />
              <GlanceStat
                label="Activities Outstanding"
                value={String(report.engagement.activitiesOutstanding)}
              />
              <GlanceStat
                label="Academic Average"
                value={formatPercentage(report.academic.academicPercentage)}
              />
              <GlanceStat label="Overall Badge" value={badge?.label ?? "Not Available"} />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">
              {academicBasisSummary(report.academic)}
            </p>
          </div>

          {report.academic.topicBreakdown.length > 0 ? (
            <div>
              <h2 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
                Progress by Topic
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Topic</th>
                      <th className="px-4 py-2">Marked Activities</th>
                      <th className="px-4 py-2">Weighted Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.academic.topicBreakdown.map((topic) => (
                      <tr key={topic.topicTitle} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-semibold text-slate-800">{topic.topicTitle}</td>
                        <td className="px-4 py-2 text-slate-600">{topic.activityCount}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {topic.earnedMarks}/{topic.availableMarks} ({topic.percentage.toFixed(1)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
              Included Work in This Report
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Lesson</th>
                      <th className="px-4 py-2">Topic</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lessons.map((lesson) => (
                      <tr key={lesson.lessonId} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-semibold text-slate-800">
                          {lesson.lessonNumber}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{lesson.topicTitle ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lessonStatusTone(lesson.status)}`}
                          >
                            {lessonStatusLabel(lesson.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {report.lessons.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                          No lessons were selected for this report.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Activity</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.activities.map((activity) => (
                      <tr key={activity.activityId} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-semibold text-slate-800">
                          {activity.lessonNumber}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activityStatusTone(activity)}`}
                          >
                            {activityStatusLabel(activity)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {activity.hasAuthoritativeMark
                            ? `${activity.finalMark}/${activity.totalMarks} (${formatPercentage(activity.percentage)})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {report.activities.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                          No activities were selected for this report.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {returnedActivityCount} of {report.activities.length} selected activities have a
              teacher-authoritative result.
            </p>
          </div>

          <div>
            <h2 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
              Work Ethic &amp; Engagement Summary
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <GlanceStat label="Lesson Engagement" value={formatRate(report.engagement.lessonCompletionRate)} />
              <GlanceStat label="Activity Completion" value={formatRate(report.engagement.activitySubmissionRate)} />
              <GlanceStat
                label="On-Time Work"
                value={formatOnTimeWork(
                  report.engagement.onTimeWorkCompletedCount,
                  report.engagement.onTimeWorkDueCount,
                )}
              />
            </div>
          </div>

          {evidenceWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-bold text-amber-900">Evidence Notes</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                {evidenceWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {comments ? (
            <div>
              <h2 className={`${neueHaas.className} mb-3 text-lg font-bold text-[#102A43]`}>
                Approved Commentary
              </h2>
              <div className="space-y-3">
                {(
                  [
                    ["Academic Development", comments.academicDevelopment],
                    ["Work Ethic & Engagement", comments.workEthicEngagement],
                    ["Exam Readiness", comments.examReadiness],
                    ["General Progress", comments.generalProgress],
                  ] as const
                ).map(([label, text]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-[#102A43]">{label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{text}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-[#102A43]">Priorities for Next Month</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {comments.prioritiesNextMonth.map((priority) => (
                      <li key={priority}>{priority}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center lg:px-10">
          <p className="text-xs text-slate-400">
            This is a read-only view of a finalised AD Astra progress report.
          </p>
        </div>
      </div>
    </div>
  );
}
