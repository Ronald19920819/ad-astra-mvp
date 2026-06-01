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

export default function SchedulePage() {
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

            <p className="text-sm text-black">Schedule</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            This Week
          </h2>

          <div className="space-y-3 text-sm text-black">
            <div>
              <p className="font-semibold">Monday</p>
              <p>Business Studies revision</p>
            </div>

            <div>
              <p className="font-semibold">Wednesday</p>
              <p>English comprehension practice</p>
            </div>

            <div>
              <p className="font-semibold">Friday</p>
              <p>Weekly activity submission deadline</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Upcoming Work
          </h2>

          <div className="space-y-2 text-sm text-black">
            <p>
              <span className="font-semibold">Business Studies:</span>{" "}
              Activity 14 due Friday
            </p>

            <p>
              <span className="font-semibold">English:</span>{" "}
              Activity 12 due Friday
            </p>

            <p>
              <span className="font-semibold">History:</span>{" "}
              Activity 10 due Friday
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Reminder
          </h2>

          <p className="text-sm text-black leading-relaxed">
            Keep all weekly activities up to date. The tutor will eventually use
            your schedule and results to guide your revision.
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
          <Link href="/activities">
  <div className="py-4">Activities</div>
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