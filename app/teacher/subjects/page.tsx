import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import {
  BarChart3,
  BookOpen,
  Languages,
  ScrollText,
} from "lucide-react";
import { getTeacherSubjectSummaryForTeacher } from "@/lib/supabase/subjectTeacherSummary";
import { subjectConfigurations } from "@/lib/subjects/subjectConfig";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

const subjectIcons = {
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  languages: Languages,
  "scroll-text": ScrollText,
} as const;

export const dynamic = "force-dynamic";

export default async function TeacherSubjectsPage() {
  const teacherProfile = await getAuthenticatedTeacherProfile();
  const visibleSubjects = teacherProfile
    ? Object.values(subjectConfigurations).filter((subject) =>
        teacherProfile.assignedSubjects.some(
          (assignedSubject) => assignedSubject.id === subject.databaseId,
        ),
      )
    : Object.values(subjectConfigurations);
  const summaryResults = await Promise.allSettled(
    visibleSubjects.map(async (subject) => ({
      subject,
      summary: teacherProfile
        ? await getTeacherSubjectSummaryForTeacher(
            teacherProfile,
            subject.databaseId,
          )
        : {
            learnerCount: 0,
            pendingReviewCount: 0,
            publishedLessonCount: 0,
            publishedActivityCount: 0,
          },
    })),
  );
  const subjects = summaryResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

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
              }}
            >
              Faculty Subjects
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {teacherProfile?.displayName ?? "Teacher"} • Subject Management
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {subjects.map((subject) => {
            const Icon = subjectIcons[subject.subject.iconKey];

            return (
              <Link
                key={subject.subject.key}
                href={subject.subject.routes.teacherOverview}
                className="block"
              >
                <div className="flex items-center gap-4 rounded-[2rem] border border-blue-100 bg-white px-4 py-4 shadow-sm">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem]"
                    style={{
                      backgroundColor: subject.subject.colourTheme.primary,
                    }}
                  >
                    <Icon
                      size={30}
                      color="white"
                      strokeWidth={2.2}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      style={{
                        color: "#0f172a",
                        fontSize: "18px",
                        fontWeight: 700,
                      }}
                    >
                      {subject.subject.displayName}
                    </h2>

                    <p
                      style={{
                        color: "#0f172a",
                        fontSize: "12px",
                        marginTop: "6px",
                      }}
                    >
                      <strong>Learners:</strong>{" "}
                      {subject.summary.learnerCount}
                    </p>

                    <p
                      style={{
                        color: "#0f172a",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      <strong>Pending Reviews:</strong>{" "}
                      {subject.summary.pendingReviewCount}
                    </p>
                  </div>

                  <span className="text-3xl font-light text-[#0f172a]">
                    ›
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4 text-[#508DB1]">
              Subjects
            </div>
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
