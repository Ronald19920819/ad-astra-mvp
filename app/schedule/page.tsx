import Image from "next/image";
import Link from "next/link";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import { CalendarDays, ClipboardCheck, PencilLine, HeartPulse } from "lucide-react";

export default function SchedulePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32">
      <div className="max-w-md mx-auto">
        {/* Hero Banner */}
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
              Schedule
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
              {learner.name} • Plan your day with purpose.
            </p>
          </div>
        </div>

        {/* Timetable Card */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#EEF7FF]">
              <CalendarDays size={30} color="#508DB1" strokeWidth={2.2} />
            </div>

            <div className="flex-1">
              <h2 className={`${neueHaas.className} text-xl font-bold text-[#0f172a]`}>
                My Timetable
              </h2>

              <p className={`${neueHaas.className} mt-2 text-sm text-slate-600 leading-relaxed`}>
                Add your school timetable so AD Astra can help you plan your lessons,
                activities, and study time.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
  <Link href="/schedule/timetable">
    <div className="rounded-2xl bg-[#102A43] py-3 text-center text-sm font-bold text-white">
      View Timetable
    </div>
  </Link>

  <Link href="/schedule/timetable/edit">
    <div className="rounded-2xl border border-[#102A43] bg-white py-3 text-center text-sm font-bold text-[#102A43]">
      Edit Timetable
    </div>
  </Link>
</div>
            </div>
          </div>
        </div>

        {/* Best Process Card */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#EEF7FF]">
              <ClipboardCheck size={30} color="#508DB1" strokeWidth={2.2} />
            </div>

            <div className="flex-1">
              <h2 className={`${neueHaas.className} text-xl font-bold text-[#0f172a]`}>
                Best Next Steps
              </h2>

              <p className={`${neueHaas.className} mt-2 text-sm text-slate-600`}>
                Suggested order for today:
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[#EEF7FF] p-4">
                  <p className={`${neueHaas.className} text-sm font-bold text-[#0f172a]`}>
                    1. Complete Business Studies Activity 16
                  </p>
                  <p className={`${neueHaas.className} mt-1 text-xs text-slate-600`}>
                    Highest priority because it is due soon.
                  </p>
                </div>

                <div className="rounded-2xl bg-white border border-blue-100 p-4">
                  <p className={`${neueHaas.className} text-sm font-bold text-[#0f172a]`}>
                    2. Review English comprehension notes
                  </p>
                  <p className={`${neueHaas.className} mt-1 text-xs text-slate-600`}>
                    Prepare before attempting your next activity.
                  </p>
                </div>

                <div className="rounded-2xl bg-white border border-blue-100 p-4">
                  <p className={`${neueHaas.className} text-sm font-bold text-[#0f172a]`}>
                    3. Revise History weak area
                  </p>
                  <p className={`${neueHaas.className} mt-1 text-xs text-slate-600`}>
                    Short focused revision is enough for today.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recuperate Card */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#EEF7FF]">
              <HeartPulse size={30} color="#508DB1" strokeWidth={2.2} />
            </div>

            <div className="flex-1">
              <h2 className={`${neueHaas.className} text-xl font-bold text-[#0f172a]`}>
                Recuperate
              </h2>

              <p className={`${neueHaas.className} mt-2 text-sm text-slate-600 leading-relaxed`}>
                Rest is part of learning. Take a short break, drink water, stretch,
                or go outside for ten minutes before your next task.
              </p>

              <div className="mt-4 rounded-2xl bg-[#EEF7FF] p-4">
                <p className={`${neueHaas.className} text-sm font-bold text-[#0f172a]`}>
                  Today’s Reset
                </p>
                <p className={`${neueHaas.className} mt-1 text-xs text-slate-600`}>
                  Step away from the screen for 10 minutes and return with a clear mind.
                </p>
              </div>
            </div>
          </div>
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