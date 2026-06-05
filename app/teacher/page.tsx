import Image from "next/image";
import Link from "next/link";
import { Indie_Flower, Oxanium } from "next/font/google";
import { learner } from "@/data/learners";

const indieFlower = Indie_Flower({
  weight: "400",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  weight: "600",
  subsets: ["latin"],
});

export default function TeacherDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border border-blue-100 p-4 flex items-center gap-4 mb-6">
          <Image
            src="/ad_astra_logo.png"
            alt="AD Astra Logo"
            width={54}
            height={54}
          />

          <div>
            <p className={`${oxanium.className} text-xl font-semibold text-black tracking-wide`}>
              AD ASTRA
            </p>

            <h1 className={`${indieFlower.className} text-4xl text-black leading-tight`}>
              Teacher
            </h1>

            <p className="text-sm text-black">Dashboard</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Subjects
          </h2>

          <Link href="/teacher/business-studies">
            <div className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4 cursor-pointer">
              <p className="font-semibold text-black">Business Studies</p>
              <p className="text-sm text-black mt-1">Learners: 1</p>
              <p className="text-sm text-black">Submitted Work: 1</p>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Recent Submissions
          </h2>

          <div className="rounded-2xl border border-yellow-200 bg-[#FFF8E6] p-4 text-sm text-black">
            <p className="font-semibold">{learner.name}</p>
            <p>Activity 16</p>
            <p>Status: Submitted</p>
            <p>Provisional Mark: 21 / 30</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Quick Actions
          </h2>

          <div className="space-y-3">
            <Link href="/teacher/business-studies">
              <div className="rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white">
                View Business Studies Learners
              </div>
            </Link>

            <div className="rounded-2xl bg-white border border-blue-100 py-3 text-center text-sm font-semibold text-black">
              Review Submissions
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}