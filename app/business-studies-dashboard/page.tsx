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

const businessStudies = learner.subjects.find(
  (subject) => subject.slug === "business-studies"
);

export default function BusinessStudiesDashboard() {
  if (!businessStudies) {
    return null;
  }

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
            <p
              className={`${oxanium.className} text-xl font-semibold text-black tracking-wide`}
            >
              AD ASTRA
            </p>

            <h1
              className={`${indieFlower.className} text-4xl text-black leading-tight`}
            >
              Business Studies
            </h1>

            <p className="text-sm text-black">
              {learner.name} • Subject Dashboard
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Learning Overview
          </h2>

          <div className="space-y-2 text-sm text-black">
            <p>
              <span className="font-semibold">Latest Mark:</span>{" "}
              {businessStudies.latestMark}%
            </p>

            <p>
              <span className="font-semibold">Current Topic:</span>{" "}
              {businessStudies.currentTopic}
            </p>

            <p>
              <span className="font-semibold">Focus Area:</span>{" "}
              {businessStudies.focusArea}
            </p>

            <p>
              <span className="font-semibold">Current Activity:</span>{" "}
              {businessStudies.nextActivity}
            </p>

            <p>
              <span className="font-semibold">Due:</span>{" "}
              {businessStudies.dueDate}
            </p>

            <p>
              <span className="font-semibold">Status:</span>{" "}
              {businessStudies.status}
            </p>
            <Link href="/business-studies-activity">
  <div className="mt-4 rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white">
    Open Current Activity
  </div>
</Link>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Next Steps
          </h2>

          <div className="space-y-3 text-sm text-black">
            <p>
              Revise <span className="font-semibold">{businessStudies.currentTopic}</span>.
            </p>

            <p>
              Practise answering application questions using short case-study
              examples.
            </p>

            <p>
              Ask the tutor to help you understand the question before writing
              the full answer.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Tutor Support
          </h2>

          <p className="text-sm text-black leading-relaxed mb-4">
            The tutor will help you think through Business Studies questions
            without simply giving you the answer.
          </p>

          <Link href="/business-studies">
            <div className="rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white">
              Open Business Studies Tutor
            </div>
          </Link>
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