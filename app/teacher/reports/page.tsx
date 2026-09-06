import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import { AuthenticatedTeacherName } from "@/components/teachers/AuthenticatedTeacherName";
import { TeacherReportsTabs } from "@/components/teachers/TeacherReportsTabs";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// ?tab=archive lets a deep link (the historical report page's "Back to
// Finalised Reports" link, or an archive card's own link back to itself)
// land directly on the Finalised Reports tab -- resolved server-side via
// Next's own searchParams prop, never a client useSearchParams hook, so
// there is no hydration mismatch or Suspense boundary to manage here.
export default async function TeacherReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialTab = resolvedSearchParams?.tab === "archive" ? "archive" : "create";

  const teacherProfile = await getAuthenticatedTeacherProfile();

  // Mirrors the exact same "subjects this teacher is actually assigned
  // to" filter already used by app/teacher/subjects/page.tsx -- a teacher
  // must never see (or generate a report against) a subject they don't
  // teach.
  const assignedSubjects = teacherProfile
    ? Object.values(subjectConfigurations).filter((subject) =>
        teacherProfile.assignedSubjects.some(
          (assignedSubject) => assignedSubject.id === subject.databaseId,
        ),
      )
    : [];

  const subjectOptions = assignedSubjects.map((subject) => ({
    key: subject.key,
    databaseId: subject.databaseId,
    displayName: subject.displayName,
    colourTheme: subject.colourTheme,
  }));

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "190px",
            backgroundImage: "url('/hero-banner-2.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 flex h-full flex-col p-5 pt-2">
            <div className="mb-3 flex items-center gap-3">
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
                style={{ width: "180px", height: "auto" }}
              />
            </div>

            <h1 className="text-xl font-bold text-white">Reports</h1>
            <p className="mt-1 text-sm font-medium text-[#d0d4dd]">
              <AuthenticatedTeacherName /> • Generate learner progress reports.
            </p>
          </div>
        </div>

        {subjectOptions.length === 0 ? (
          <p className="rounded-[2rem] border border-red-100 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
            You are not currently assigned to any subject, so no reports can be
            generated yet.
          </p>
        ) : (
          <TeacherReportsTabs subjects={subjectOptions} initialTab={initialTab} />
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black lg:max-w-6xl">
          <Link href="/teacher"><div className="py-4">Home</div></Link>
          <Link href="/teacher/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/teacher/messages"><div className="py-4">Messages</div></Link>
          <Link href="/teacher/reports"><div className="py-4 text-[#508DB1]">Reports</div></Link>
          <Link href="/teacher/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}
