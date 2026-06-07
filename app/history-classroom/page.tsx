import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, PlayCircle, ScrollText, ChevronDown } from "lucide-react";
import { neueHaas } from "@/app/fonts";

export default function HistoryClassroom() {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="max-w-md mx-auto">
        <div className="bg-[#102A43] rounded-[2rem] p-5 text-white mb-6 shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/history-dashboard">
              <ArrowLeft size={22} />
            </Link>

            <Image
              src="/re-petersen.png"
              alt="Teacher Ronald"
              width={48}
              height={48}
              className="rounded-full"
            />

            <div>
              <h1 className="text-lg font-bold">
                History Classroom
              </h1>

              <p className="text-sm text-blue-100">
                Teacher Ronald
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Current Week
              </h2>

              <p className="text-sm text-black/60">
                Week 3 • Term 2
              </p>
            </div>

            <div className="rounded-full bg-[#EEFBEA] px-4 py-2 text-sm font-semibold text-[#3AAA35]">
              Active
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm mb-5">
          <div className="mb-4 flex items-center gap-3">
            <PlayCircle size={22} className="text-[#3AAA35]" />

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Lesson 2.5
              </h2>

              <p className="text-sm text-black/60">
                The Treaty of Versailles
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full rounded-2xl bg-[#EEFBEA] py-3 text-sm font-semibold text-[#3AAA35]">
              Watch Video Lesson
            </button>

            <button className="w-full rounded-2xl border border-green-100 py-3 text-sm font-semibold text-black">
              Open Reading
            </button>

            <button className="w-full rounded-2xl bg-[#3AAA35] py-3 text-sm font-semibold text-white">
              Take Quick Quiz
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm mb-5">
          <div className="mb-4 flex items-center gap-3">
            <PlayCircle size={22} className="text-[#3AAA35]" />

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Lesson 2.6
              </h2>

              <p className="text-sm text-black/60">
                The League of Nations
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full rounded-2xl bg-[#EEFBEA] py-3 text-sm font-semibold text-[#3AAA35]">
              Watch Video Lesson
            </button>

            <button className="w-full rounded-2xl border border-green-100 py-3 text-sm font-semibold text-black">
              Open Reading
            </button>

            <button className="w-full rounded-2xl bg-[#3AAA35] py-3 text-sm font-semibold text-white">
              Take Quick Quiz
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Previous Weeks
              </h2>

              <p className="text-sm text-black/60">
                Earlier classroom content
              </p>
            </div>

            <ChevronDown
              size={22}
              className="text-[#3AAA35]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}