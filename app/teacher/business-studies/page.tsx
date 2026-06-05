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

export default function TeacherBusinessStudiesPage() {
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
              Business Studies
            </h1>

            <p className="text-sm text-black">Teacher View</p>
          </div>
        </div>

       <Link href="/teacher/business-studies/danielle-coetzee">
  <div className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4 text-sm text-black cursor-pointer">
    <p className="font-semibold">{learner.name}</p>
    <p>Latest Mark: {learner.subjects[0].latestMark}%</p>
    <p>Focus Area: {learner.subjects[0].focusArea}</p>
    <p>Status: Activity 16 Submitted</p>
  </div>
</Link>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Submitted Work
          </h2>

          <Link href="/teacher/business-studies/activity-16">
            <div className="rounded-2xl border border-yellow-200 bg-[#FFF8E6] p-4 cursor-pointer text-sm text-black">
              <p className="font-semibold">Activity 16</p>
              <p>{learner.name}</p>
              <p>Provisional Mark: 21 / 30</p>
              <p>Status: Ready for teacher review</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}