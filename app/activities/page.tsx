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

export default function ActivitiesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36">
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
              {learner.name}
            </h1>

            <p className="text-sm text-black">Activities</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Current Activities
          </h2>

          <div className="space-y-4 text-sm text-black">
            <div className="rounded-2xl border border-blue-100 p-4 bg-[#EEF7FF]">
              <p className="font-semibold">Business Studies</p>
              <p>Activity 14</p>
              <p>Due: Friday</p>
              <p>Status: Not Started</p>

              <Link href="/business-studies-activity">
  <div className="mt-3 rounded-2xl bg-black py-2 text-center text-sm font-semibold text-white">
    Open Activity
  </div>
</Link>

<Link href="/business-studies">
  <div className="mt-2 rounded-2xl bg-white border border-blue-100 py-2 text-center text-sm font-semibold text-black">
    Ask Tutor
  </div>
</Link>
            </div>

            <div className="rounded-2xl border border-blue-100 p-4 bg-[#EEF7FF]">
              <p className="font-semibold">English</p>
              <p>Activity 12</p>
              <p>Due: Friday</p>
              <p>Status: Complete</p>

              <div className="mt-3 rounded-2xl bg-white border border-blue-100 py-2 text-center text-sm font-semibold text-black">
                View Feedback
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 p-4 bg-[#EEF7FF]">
              <p className="font-semibold">History</p>
              <p>Activity 10</p>
              <p>Due: Friday</p>
              <p>Status: In Progress</p>

              <div className="mt-3 rounded-2xl bg-white border border-blue-100 py-2 text-center text-sm font-semibold text-black">
                Continue
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Tutor Note
          </h2>

          <p className="text-sm text-black leading-relaxed">
            Activities will eventually connect to readings, learner submissions,
            teacher feedback and AI tutor support.
          </p>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-blue-100">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/chat">
  <div className="py-4">Chat</div>
</Link>

          <Link href="/schedule">
            <div className="py-4">Schedule</div>
          </Link>

          <Link href="/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}