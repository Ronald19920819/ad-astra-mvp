"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { neueHaas } from "@/app/fonts";
import {
  FileText,
  Download,
  Sparkles,
  Calendar,
  BookOpen,
  Users,
  Send,
} from "lucide-react";

export default function TeacherReportsPage() {
  const [generated, setGenerated] = useState(false);

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}
    >
      <div className="max-w-md mx-auto">
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

            <h1 className="text-xl font-bold text-white">
              Reports
            </h1>

            <p className="mt-1 text-sm font-medium text-[#d0d4dd]">
              RE Petersen • Generate learner progress reports.
            </p>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Sparkles size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Report Generator
              </h2>
              <p className="text-xs font-medium text-black/50">
                Create reports from existing learner data
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <p className="mb-2 text-sm font-bold text-[#102A43]">
                Subject / Class
              </p>

              <select className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]">
                <option>Business Studies</option>
                <option>English</option>
                <option>Afrikaans</option>
                <option>History</option>
              </select>
            </label>

            <label className="block">
              <p className="mb-2 text-sm font-bold text-[#102A43]">
                Reporting Period
              </p>

              <select className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]">
                <option>January - February</option>
                <option>March - April</option>
                <option>May - June</option>
                <option>July - August</option>
                <option>September - October</option>
              </select>
            </label>

            <label className="block">
              <p className="mb-2 text-sm font-bold text-[#102A43]">
                Report Type
              </p>

              <select className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]">
                <option>Progress Report</option>
                <option>Intervention Report</option>
                <option>End-of-Term Summary</option>
              </select>
            </label>

            <button
              onClick={() => setGenerated(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white shadow-sm"
            >
              <Sparkles size={18} />
              Generate Reports
            </button>
          </div>
        </section>

        {generated && (
          <section className="mb-5 rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-[#EEFBEA] p-3 text-[#3AAA35]">
                <FileText size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Reports Generated
                </h2>
                <p className="text-xs font-medium text-black/50">
                  Business Studies • January - February
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-green-100 bg-[#F7FFF5] p-4">
              <p className="text-sm font-bold text-black">
                8 learner reports ready
              </p>
              <p className="mt-1 text-xs text-black/60">
                Reports are ready to download. Parent sharing will be added later.
              </p>
            </div>

            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3AAA35] py-3 text-sm font-semibold text-white shadow-sm">
              <Download size={18} />
              Download Reports
            </button>
          </section>
        )}

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Calendar size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Recent Reports
              </h2>
              <p className="text-xs font-medium text-black/50">
                Previously generated report batches
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4">
              <p className="text-sm font-bold text-black">
                Business Studies
              </p>
              <p className="mt-1 text-xs text-black/50">
                January - February • 8 learners
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4">
              <p className="text-sm font-bold text-black">
                English
              </p>
              <p className="mt-1 text-xs text-black/50">
                March - April • 7 learners
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <BookOpen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Report Data Sources
              </h2>
              <p className="text-xs font-medium text-black/50">
                What AD Astra will use later
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-black/70">
            <div className="flex items-start gap-3">
              <Users size={18} className="mt-0.5 text-[#508DB1]" />
              <p>Learner activity completion and submission history.</p>
            </div>

            <div className="flex items-start gap-3">
              <FileText size={18} className="mt-0.5 text-[#508DB1]" />
              <p>Marks, AI feedback, teacher review and improvement patterns.</p>
            </div>

            <div className="flex items-start gap-3">
              <Send size={18} className="mt-0.5 text-[#508DB1]" />
              <p>Future option to send reports directly to parent dashboards.</p>
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4 text-[#508DB1]">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}