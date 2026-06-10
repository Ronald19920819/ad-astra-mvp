import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  FileText,
  SquarePen,
  ClipboardCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function TeacherEnglishPage() {
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

          <div className="relative z-10 h-full p-6 flex flex-col pt-3">
            <div className="flex items-center gap-4 mb-4 -mt-4">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={70}
                height={70}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark_2.png"
                alt="AD ASTRA"
                width={210}
                height={55}
                priority
                style={{
                  width: "210px",
                  height: "auto",
                }}
              />
            </div>

            <Link
              href="/teacher/subjects"
              className="mb-4 flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
            >
              <ArrowLeft size={14} />
              Back to Subjects
            </Link>

            <h1
              style={{
                color: "white",
                fontSize: "22px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              English
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              RE Petersen • Faculty Dashboard
            </p>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
              <BookOpen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Subject Overview
              </h2>
              <p className="text-xs font-medium text-black/50">
                Business Studies workload summary
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">8</p>
              <p className="text-xs font-medium text-black/60">Enrolled Learners</p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#2563EB]">12</p>
              <p className="text-xs font-medium text-black/60">
                Pending Reviews
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">4</p>
              <p className="text-xs font-medium text-black/60">
                Lessons Published
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-red-500">3</p>
              <p className="text-xs font-medium text-black/60">
                at-risk learners
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
              <BookOpen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Classroom Management
              </h2>
              <p className="text-xs font-medium text-black/50">
                Videos, readings and pop quizzes
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
           Manage lessons, videos, readings and quizzes available to learners.
          </p>

          

          <Link href="/teacher/subjects/english/classroom">
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3">
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-[#2563EB]" />
                <p className="text-sm font-semibold text-black">
                  Open Classroom
                </p>
              </div>

              <span className="text-lg font-bold text-[#2563EB]">→</span>
            </div>
          </Link>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
              <SquarePen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Activity Management
              </h2>
              <p className="text-xs font-medium text-black/50">
                Upload work and review submissions
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
             Manage lesson activities, submissions and assessment tasks.
          </p>

          

          <Link href="/teacher/subjects/english/activities">
            <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3">
              <div className="flex items-center gap-3">
                <SquarePen size={18} className="text-[#2563EB]" />
                <p className="text-sm font-semibold text-black">
                  Open Activity Centre
                </p>
              </div>

              <span className="text-lg font-bold text-[#2563EB]">→</span>
            </div>
          </Link>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
              <ClipboardCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learning Tracker
              </h2>
              <p className="text-xs font-medium text-black/50">
                Video, reading and quiz completion
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-blue-100">
            <div className="grid grid-cols-4 bg-[#EEF5FF] px-3 py-3 text-xs font-bold text-[#102A43]">
              <p>Learner</p>
              <p>Video</p>
              <p>Reading</p>
              <p>Quiz</p>
            </div>

            <div className="grid grid-cols-4 items-center border-t border-blue-100 px-3 py-3 text-xs">
  <p className="font-semibold text-black">Lesson 2.5</p>

  <AlertCircle size={16} className="text-red-500" />

  <CheckCircle2 size={16} className="text-green-600" />

  <p className="font-bold text-red-500">9/20</p>
</div>
            
          </div>

          <Link href="/teacher/subjects/english/learning-tracker">
            <div className="mt-4 rounded-2xl bg-[#102A43] py-3 text-center text-sm font-semibold text-white">
              Open Learning Tracker
            </div>
          </Link>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
              <FileText size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Activity Review
              </h2>
              <p className="text-xs font-medium text-black/50">
                Submissions, AI marks and teacher review
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-blue-100">
            <div className="grid grid-cols-4 bg-[#EEF5FF] px-3 py-3 text-xs font-bold text-[#102A43]">
              <p>Learner</p>
              <p>Submit</p>
              <p>AI Mark</p>
              <p>Status</p>
            </div>

            <div className="grid grid-cols-4 items-center border-t border-blue-100 px-3 py-3 text-xs">
  <p className="font-semibold text-black">Activity 5</p>

  <p className="font-semibold text-green-600">6/8</p>

  <p className="font-bold text-red-500">9/20</p>

  <p className="font-semibold text-[#2563EB]">Needs Review</p>
</div>

            
          </div>

          <Link href="/teacher/subjects/english/activity-review">
            <div className="mt-4 rounded-2xl bg-[#102A43] py-3 text-center text-sm font-semibold text-white">
              Open Activity Review
            </div>
          </Link>
        </section>

        <Link href="/teacher/subjects/english/learners">
          <section className="rounded-[1.5rem] border border-blue-100 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#EEF5FF] p-3 text-[#2563EB]">
                  <Users size={20} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#102A43]">
                    Learners
                  </h2>
                  <p className="text-xs font-medium text-black/50">
                    View individual learner progress
                  </p>
                </div>
              </div>

              <span className="text-lg font-bold text-[#2563EB]">→</span>
            </div>
          </section>
        </Link>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4 text-[#508DB1]">Subjects</div>
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