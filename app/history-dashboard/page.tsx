import Image from "next/image";
import Link from "next/link";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import {
  ScrollText,
  GraduationCap,
  SquarePen,
  FileText,
  PlayCircle,
} from "lucide-react";

const history = learner.subjects.find(
  (subject) => subject.slug === "history"
);

export default function HistoryDashboard() {
  if (!history) {
    return null;
  }

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}>
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "190px",
            backgroundImage: "url('/hero-banner.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col justify-center">
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
                src="/ad_astra_wordmark.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{ width: "180px", height: "auto" }}
              />
            </div>

            <h1 style={{ color: "white", fontSize: "20px", fontWeight: 700 }}>
              History
            </h1>

            <p style={{ color: "#d0d4dd", fontSize: "14px", fontWeight: 500, marginTop: "6px" }}>
              {learner.name} • Subject Dashboard
            </p>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEFBEA] p-3 text-[#3AAA35]">
              <ScrollText size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Learning Overview</h2>
              <p className="text-xs font-medium text-black/50">
                Current History progress
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-black">
            <p><span className="font-semibold">Latest Mark:</span> {history.latestMark}%</p>
            <p><span className="font-semibold">Current Topic:</span> {history.currentTopic}</p>
            <p><span className="font-semibold">Focus Area:</span> {history.focusArea}</p>
            <p><span className="font-semibold">Current Activity:</span> {history.nextActivity}</p>
            <p><span className="font-semibold">Due:</span> {history.dueDate}</p>
            <p><span className="font-semibold">Status:</span> {history.status}</p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEFBEA] p-3 text-[#3AAA35]">
              <GraduationCap size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Classroom</h2>
              <p className="text-xs font-medium text-black/50">
                Lessons, videos and readings
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
            Study History lessons, source skills, readings and coursework support.
          </p>

          <Link href="/history-classroom">
            <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-[#F7FFF5] px-4 py-3">
              <div className="flex items-center gap-3">
                <ScrollText size={18} className="text-[#3AAA35]" />
                <p className="text-sm font-semibold text-black">Open Classroom</p>
              </div>

              <PlayCircle size={18} className="text-[#3AAA35]" />
            </div>
          </Link>
        </section>

        <section className="mb-5 rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEFBEA] p-3 text-[#3AAA35]">
              <SquarePen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Activities</h2>
              <p className="text-xs font-medium text-black/50">
                Complete and submit your work
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
            Complete History source questions, essay practice and coursework activities.
          </p>

          <Link href="/history-activities">
            <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-[#F7FFF5] px-4 py-3">
              <div className="flex items-center gap-3">
                <SquarePen size={18} className="text-[#3AAA35]" />
                <p className="text-sm font-semibold text-black">Open Activities</p>
              </div>

              <FileText size={18} className="text-[#3AAA35]" />
            </div>
          </Link>
        </section>

        <Link href="/history-your-work">
          <section className="mt-5 rounded-[1.5rem] border border-green-100 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#EEFBEA] p-3 text-[#3AAA35]">
                  <FileText size={20} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#102A43]">
                    Your Work
                  </h2>
                  <p className="text-xs font-medium text-black/50">
                    View submitted activities and marks
                  </p>
                </div>
              </div>

              <span className="text-lg font-bold text-[#3AAA35]">→</span>
            </div>
          </section>
        </Link>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4 text-[#508DB1]">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}