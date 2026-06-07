import Image from "next/image";
import Link from "next/link";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import { Plus, MessageCircle, Clock } from "lucide-react";

const projects = [
  {
    title: "Business Studies Revision",
    detail: "Application questions and exam practice",
    lastActive: "Last active today",
  },
  {
    title: "History Coursework",
    detail: "Planning, paragraphs and judgement",
    lastActive: "Last active yesterday",
  },
  {
    title: "Exam Preparation",
    detail: "Revise weak areas across subjects",
    lastActive: "Last active 3 days ago",
  },
];

export default function TutorLandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32">
      <div className="mx-auto max-w-md">
        <div
          className="relative mb-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
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
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <h1
              className={`${neueHaas.className}`}
              style={{
                color: "white",
                fontSize: "30px",
                fontWeight: 700,
              }}
            >
              Kingdom Workspace
            </h1>

            <p
              className={`${neueHaas.className}`}
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {learner.name} • Continue your learning projects.
            </p>
          </div>
        </div>

        <Link href="/tutor/chat">
          <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-[#EEF7FF]">
                <Plus size={30} color="#508DB1" strokeWidth={2.2} />
              </div>

              <div>
                <h2 className={`${neueHaas.className} text-xl font-bold text-[#0f172a]`}>
                  Start New Project
                </h2>
                <p className={`${neueHaas.className} mt-1 text-sm text-slate-600`}>
                  Begin a new conversation with Kingdom.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <p className={`${neueHaas.className} mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#508DB1]`}>
          Continue Learning
        </p>

        <div className="space-y-4">
          {projects.map((project) => (
            <Link key={project.title} href="/tutor/chat" className="block">
              <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[#EEF7FF]">
                    <MessageCircle size={26} color="#508DB1" strokeWidth={2.2} />
                  </div>

                  <div className="flex-1">
                    <h3 className={`${neueHaas.className} text-base font-bold text-[#0f172a]`}>
                      {project.title}
                    </h3>

                    <p className={`${neueHaas.className} mt-1 text-sm text-slate-600`}>
                      {project.detail}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={14} />
                      <span>{project.lastActive}</span>
                    </div>
                  </div>

                  <span className="text-3xl font-light text-[#0f172a]">›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}