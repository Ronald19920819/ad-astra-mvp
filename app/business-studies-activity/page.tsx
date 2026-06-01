"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Indie_Flower, Oxanium } from "next/font/google";
import { learner } from "@/data/learners";
import { lesson16 } from "@/data/businessStudies/lesson16";
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

export default function BusinessStudiesActivityPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasLoadedAnswers, setHasLoadedAnswers] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activityStatus, setActivityStatus] = useState("In Progress");

  useEffect(() => {
    const savedAnswers = localStorage.getItem("business-studies-activity-16");

    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }

    setHasLoadedAnswers(true);
  }, []);

  useEffect(() => {
    const savedStatus = localStorage.getItem(
      "business-studies-activity-16-status"
    );

    if (savedStatus) {
      setActivityStatus(savedStatus);
    }
  }, []);

  if (!businessStudies) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-40">
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
              Activity {lesson16.id}
            </h1>

            <p className="text-sm text-black">
              {businessStudies.name} • {learner.name}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Topic
          </h2>

          <div className="space-y-2 text-sm text-black">
            <p>
              <span className="font-semibold">Current Topic:</span>{" "}
              {businessStudies.currentTopic}
            </p>

            <p>
              <span className="font-semibold">Focus Area:</span>{" "}
              {businessStudies.focusArea}
            </p>

            <p>
              <span className="font-semibold">Due:</span>{" "}
              {businessStudies.dueDate}
            </p>
            <p>
  <span className="font-semibold">Status:</span> {activityStatus}
</p>
          </div>
        </div>
<Image
  src="/lesson-banner.png"
  alt="Business Studies Lesson"
  width={800}
  height={450}
  className="w-full rounded-3xl mb-6"
/>
       {lesson16.readingSections.map((section) => (
  <div key={section.heading} className="mb-4">
    <h3 className="font-semibold text-black mb-2">
      {section.heading}
    </h3>

    <p className="text-sm text-black leading-relaxed">
      {section.content}
    </p>
  </div>
))}

        <div className="space-y-4 text-sm text-black">
  {lesson16.questions.map((question) => (
    <div key={question.id}>
      <p className="font-semibold">
        {question.id}. {question.question} [{question.marks}]
      </p>

      <p className="text-xs text-slate-600 mt-1">
        Command Word: {question.commandWord} — {question.guidance}
      </p>

    <textarea
  value={answers[question.id] || ""}
  onChange={(event) => {
    const updatedAnswers = {
      ...answers,
      [question.id]: event.target.value,
    };

    setAnswers(updatedAnswers);

    localStorage.setItem(
      "business-studies-activity-16",
      JSON.stringify(updatedAnswers)
    );
  }}
  className="mt-2 w-full min-h-24 rounded-2xl border border-slate-300 p-3 text-sm text-black outline-none focus:border-blue-500"
  placeholder="Type your answer here..."
/>
    </div>
  ))}
</div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Need Help?
          </h2>

          <p className="text-sm text-black leading-relaxed mb-4">
            If you are stuck, open the tutor and ask for guidance. The tutor
            should help you understand the question, not simply give the answer.
          </p>

          <Link href="/business-studies">
            <div className="rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white">
              Ask Business Studies Tutor
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Submit
          </h2>

         <button
  type="button"
  onClick={() => {
  setSubmitted(true);
  setActivityStatus("Submitted");
  localStorage.setItem("business-studies-activity-16-status", "Submitted");
}}
  className="w-full rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white"
>
  Submit Activity
</button>

{submitted && hasLoadedAnswers && (
  <div className="mt-4 space-y-3 text-sm text-black">
    <p className="font-semibold">
      Activity submitted successfully.
    </p>
<div className="rounded-2xl border border-yellow-200 bg-[#FFF8E6] p-4 space-y-2">
  <p className="font-semibold text-black">Provisional Feedback</p>

  <p>
    ✓ You have submitted your answers for Activity 16.
  </p>

  <p>
    ✓ You attempted the recruitment and selection questions.
  </p>

  <p>
    ⚠ Remember: for explain, analyse and evaluate questions, you must develop
    your points and show the effect on the business.
  </p>

  <p className="font-semibold">
    Provisional Mark: 21 / {lesson16.totalMarks}
  </p>
</div>
    <div className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4 space-y-3">
      {lesson16.questions.map((question) => (
        <div key={question.id}>
          <p className="font-semibold">
            {question.id}. {question.question}
          </p>

          <p className="mt-1">
            {answers[question.id] || "No answer provided."}
          </p>
        </div>
      ))}
    </div>
  </div>
      )}
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