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

export default function HomeDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-28">
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

            <p className="text-sm text-black">
              Home Dashboard
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <p className="text-sm font-semibold text-black">Today’s Reminder</p>
          <p className="text-sm text-black mt-2">
            Activity 7 is due this Friday.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Quick Actions
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <Link href="/subjects">
              <div className="rounded-2xl bg-[#EEF7FF] border border-blue-100 p-3 text-center text-sm font-semibold text-black">
                Subjects
              </div>
            </Link>

            <Link href="/schedule">
              <div className="rounded-2xl bg-[#EEF7FF] border border-blue-100 p-3 text-center text-sm font-semibold text-black">
                Schedule
              </div>
            </Link>

            <Link href="/profile">
              <div className="rounded-2xl bg-[#EEF7FF] border border-blue-100 p-3 text-center text-sm font-semibold text-black">
                Profile
              </div>
            </Link>
          </div>
        </div>

        <div className="space-y-4 text-sm text-black">
  {learner.subjects.map((subject) => (
    <div
      key={subject.slug}
      className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4"
    >
      <p className="font-semibold text-black">{subject.name}</p>

      <p>
        <span className="font-semibold">Latest Mark:</span>{" "}
        {subject.latestMark}%
      </p>

      <p>
        <span className="font-semibold">Focus Area:</span>{" "}
        {subject.focusArea}
      </p>

      <p>
        <span className="font-semibold">Next Step:</span>{" "}
        Revise {subject.currentTopic}
      </p>
    </div>
  ))}
</div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Tutor Suggestion
          </h2>

          <p className="text-sm text-black leading-relaxed">
            {learner.name} should spend a few minutes revising how to apply Business
            Studies concepts to a case study before attempting the next
            activity.
          </p>

          <Link href="/business-studies">
            <div className="mt-4 rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white">
              Open Tutor
            </div>
          </Link>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-blue-100">
  <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
    <Link href="/home">
      <div className="py-4">
        Home
      </div>
    </Link>

    <Link href="/subjects">
      <div className="py-4">
        Subjects
      </div>
    </Link>
    <Link href="/activities">
  <div className="py-4">Activities</div>
</Link>
<Link href="/schedule">
  <div className="py-4">Schedule</div>
</Link>
    <Link href="/profile">
      <div className="py-4">
        Profile
      </div>
    </Link>
  </div>
</nav>
    </main>
  );
}