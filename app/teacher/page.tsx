import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  School,
} from "lucide-react";
import SchoolOverviewCard from "@/components/SchoolOverviewCard";
import { getAuthenticatedTeacherProfileDashboard } from "@/lib/supabase/teacherProfile";
import { getTeacherDashboardInsights } from "@/lib/supabase/teacherDashboardInsights";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage() {
  let dashboard = null;
  let insights = {
    priorityActions: [],
    learnerInsights: [],
  } as Awaited<ReturnType<typeof getTeacherDashboardInsights>>;

  try {
    dashboard = await getAuthenticatedTeacherProfileDashboard();
    if (dashboard) {
      insights = await getTeacherDashboardInsights(dashboard.profile);
    }
  } catch (error) {
    console.error("Unable to load teacher dashboard profile:", error);
  }

  const teacherName = dashboard?.profile.displayName ?? "Teacher";
  const school = dashboard?.profile.school;
  const overview = dashboard?.teachingOverview;

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}
    >
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "260px",
            backgroundImage: "url('/hero-banner-2.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col pt-2">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark_2.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <h1
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              Faculty Dashboard
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {teacherName}
              {school ? ` \u00B7 ${school}` : ""}
            </p>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <School size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                School Overview
              </h2>
              <p className="text-xs font-medium text-black/50">
                Faculty activity summary
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">
                {overview?.subjectsTaught ?? 0}
              </p>
              <p className="text-xs font-medium text-black/60">
                Subjects Managed
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">
                {overview?.activeLearners ?? 0}
              </p>
              <p className="text-xs font-medium text-black/60">
                Learners
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#F97316]">
                {overview?.submissionsAwaitingReview ?? 0}
              </p>
              <p className="text-xs font-medium text-black/60">
                Submissions Awaiting Review
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">
                {overview?.publishedLessons ?? 0}
              </p>
              <p className="text-xs font-medium text-black/60">
                Published Lessons
              </p>
            </div>
          </div>
        </section>

        <SchoolOverviewCard
          href="/teacher/subjects"
          description="Open your subjects to manage lessons, activities, learners, and review work."
          openLabel="Open Subjects"
          pendingLabel="Opening Subjects..."
        />

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF3E6] p-3 text-[#F97316]">
              <ClipboardCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Priority Actions
              </h2>
              <p className="text-xs font-medium text-black/50">
                What needs attention today
              </p>
            </div>
          </div>

          {insights.priorityActions.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.priorityActions.map((action) => {
                const subject = getSubjectConfigurationByDatabaseId(action.subjectId);
                const colourTheme = subject?.colourTheme;

                return (
                  <Link
                    key={`${action.category}:${action.subjectId}`}
                    href={action.href}
                    className="block rounded-2xl border p-4 transition hover:shadow-sm"
                    style={{
                      borderColor: colourTheme?.border ?? "#E2E8F0",
                      backgroundColor: colourTheme?.softBackground ?? "#F8FAFC",
                    }}
                  >
                    <p className="text-sm font-bold text-black">
                      {action.subjectName}
                    </p>
                    <p className="mt-1 text-xs font-medium text-black/50">
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <BookOpen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Insights
              </h2>
              <p className="text-xs font-medium text-black/50">
                Early patterns and learner signals
              </p>
            </div>
          </div>

          {insights.learnerInsights.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              No new learner insights yet.
            </p>
          ) : (
            <div className="space-y-3 text-sm text-black/70">
              {insights.learnerInsights.map((insight) => {
                const Icon =
                  insight.kind === "highest_overdue_burden"
                    ? AlertCircle
                    : BarChart3;
                const iconClassName =
                  insight.kind === "highest_overdue_burden"
                    ? "mt-0.5 text-red-500"
                    : "mt-0.5 text-[#508DB1]";

                return (
                  <div
                    key={`${insight.kind}:${insight.subjectId}`}
                    className="flex items-start gap-3"
                  >
                    <Icon size={18} className={iconClassName} />
                    <p>{insight.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4 text-[#508DB1]">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}
